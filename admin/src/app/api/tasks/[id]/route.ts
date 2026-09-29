import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { includeDeleted } from "@/lib/softDelete";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;

    // ?includeDeleted=true lets the task page open a soft-deleted task in a
    // read-only state. Without it the extension hides deleted rows, which is
    // what every other caller wants.
    const { searchParams } = new URL(req.url);
    const allowDeleted = searchParams.get("includeDeleted") === "true";

    const task = await prisma.task.findFirst({
      where: allowDeleted ? { id, ...includeDeleted } : { id },
      include: {
        ownerShipBy: true,
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true, // Re-enabled category
        legislation: true, // Added legislation relation
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            agent: {
              select: {
                id: true,
                name: true,
                email: true,
                photo: true,
              },
            },
            task: false, // Explicitly exclude task to avoid circular reference
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        timeLogs: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                email: true,
                photo: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
        },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error(`Error fetching task ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Get the current task to check if it's being marked as "Hold"
    const currentTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "triggerDate",
      "progress",
      "followUpRequired",
      "completed",
      "recurring",
      "recurringType",
      "recurringWeekDays",
      "followUpDuration",
      "statusCheckDuration",
      "statusProgressMap",
      "active",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === "recurring") {
          const recurringValue = body[key] as string;
          data[key] =
            recurringValue && recurringValue !== "0"
              ? parseInt(recurringValue)
              : null;
        } else if (key === "recurringType" || key === "recurringWeekDays") {
          // Handled after the loop, together with `recurring`.
          continue;
        } else if (key === "dueDate" || key === "triggerDate") {
          const dateValue = body[key] as string | null;
          data[key] = dateValue ? new Date(dateValue) : null;
        } else if (key === "statusProgressMap") {
          data[key] = body[key];
        } else {
          data[key] = body[key];
        }
      }
    }

    // `recurring` (the interval) and `recurringType` (its unit) only mean
    // something as a pair: the cron reads one to size the other. Writing them
    // independently let "No Recurring" null the interval while a stale
    // "MONTH" stayed behind, which froze the task's trigger date, and let an
    // interval survive with no unit, which the cron then treated as months.
    // Clearing one clears both, and setting one requires the other.
    if (data.recurring !== undefined || body.recurringType !== undefined) {
      const clearedByInterval =
        data.recurring !== undefined && data.recurring === null;
      const type =
        body.recurringType === undefined
          ? currentTask.recurringType
          : body.recurringType;
      const normalizedType =
        typeof type === "string" && type.trim() ? type.trim().toUpperCase() : null;

      if (clearedByInterval || !normalizedType) {
        data.recurring = null;
        data.recurringType = null;
        data.recurringWeekDays = [];
      } else {
        const interval =
          data.recurring !== undefined ? data.recurring : currentTask.recurring;
        if (interval === null || interval === undefined) {
          data.recurring = null;
          data.recurringType = null;
          data.recurringWeekDays = [];
        } else {
          data.recurring = interval;
          data.recurringType = normalizedType;

          // Weekdays belong to a WEEK schedule only. Switching a weekly task to
          // any other type drops the set, so a stale [Mon, Wed] cannot keep
          // overriding the interval after the change.
          if (normalizedType !== "WEEK") {
            data.recurringWeekDays = [];
          } else if (body.recurringWeekDays !== undefined) {
            data.recurringWeekDays = Array.isArray(body.recurringWeekDays)
              ? [
                  ...new Set<number>(
                    body.recurringWeekDays
                      .map((day: unknown) => Number(day))
                      .filter(
                        (day: number) =>
                          Number.isInteger(day) && day >= 1 && day <= 7,
                      ),
                  ),
                ].sort((a: number, b: number) => a - b)
              : [];
          }
        }
      }
    }

    // Handle relations
    if (body.clientId) {
      data.client = { connect: { id: body.clientId } };
    }
    if (body.assignedToId) {
      data.assignedTo = { connect: { id: body.assignedToId } };
    }
    if (body.ownerShipById) {
      data.ownerShipBy = { connect: { id: body.ownerShipById } };
    }
    if (body.categoryId) {
      data.category = { connect: { id: body.categoryId } };
    }
    if (body.legislationId) {
      data.legislation = { connect: { id: body.legislationId } };
    }

    // holdDate starts the 10-day auto-resume clock, so it is stamped only when
    // the task *enters* Hold. Stamping it on every save that carried
    // status="Hold" (edit forms resend the current status) restarted the clock
    // each time, and gating it on dueDate left undated tasks with no holdDate,
    // which the cron can never resume.
    if (body.status === "Hold" && currentTask.status !== "Hold") {
      data.holdDate = new Date();
    } else if (
      body.status !== undefined &&
      body.status !== "Hold" &&
      currentTask.status === "Hold"
    ) {
      data.holdDate = null;
      data.holdDaysLeft = null;
    }
    // `status` is the visible state and `completed` is the boolean the
    // recurrence helpers read; they have to move together. Setting only
    // `lastCompletedDate` here left rows reading status="Completed" alongside
    // completed=false, so getRecurringTaskStatus() computed isOverdue from a
    // flag that disagreed with what the task page showed. An explicit
    // `completed` in the body still wins, so a caller can override.
    if (body.status === "Completed") {
      if (currentTask.status !== "Completed") {
        data.lastCompletedDate = new Date();
      }
      if (body.completed === undefined) {
        data.completed = true;
      }
    } else if (
      body.status !== undefined &&
      currentTask.status === "Completed"
    ) {
      data.lastCompletedDate = null;
      if (body.completed === undefined) {
        data.completed = false;
      }
    }
    let updatedTask = await prisma.task.update({
      where: { id },
      data,
    });

    // The next deadline is derived from triggerDate + the service's timePeriod,
    // so editing either side of that formula has to recompute it. Without this
    // an edited task keeps the deadline of its old trigger date or old service
    // until the cron next rolls it forward.
    //
    // A status-only change is explicitly not a reschedule. Completing a task
    // resubmits the whole form, so `dueDate` arrives unchanged and used to
    // re-run this block, re-deriving currentPeriodStart/nextDueDate from the
    // *current* (still un-advanced) triggerDate. On a recurring task that
    // silently dragged the displayed next trigger date back onto the period
    // that had just been completed. Only recompute when one of the inputs to
    // the formula actually changed value.
    const changedDate = (incoming: unknown, existing: Date | null) => {
      if (incoming === undefined) return false;
      const next = incoming ? new Date(incoming as string).getTime() : null;
      const prev = existing ? new Date(existing).getTime() : null;
      return next !== prev;
    };

    if (
      changedDate(body.triggerDate, currentTask.triggerDate) ||
      changedDate(body.dueDate, currentTask.dueDate) ||
      (body.categoryId !== undefined &&
        body.categoryId !== currentTask.categoryId)
    ) {
      try {
        const { initializeRecurringTask } =
          await import("@/lib/singleTaskRecurring");
        const rescheduled = await initializeRecurringTask(id);
        if (rescheduled) updatedTask = rescheduled;
      } catch (error) {
        console.error("Error recalculating task schedule:", error);
      }
    }

    // Upsert daily duration audit entries
    const today = new Date().toISOString().slice(0, 10);
    const durationFields = [
      {
        field: "followUpDuration",
        bodyVal: body.followUpDuration,
        currentVal: currentTask.followUpDuration,
      },
      {
        field: "statusCheckDuration",
        bodyVal: body.statusCheckDuration,
        currentVal: currentTask.statusCheckDuration,
      },
    ] as const;
    for (const { field, bodyVal, currentVal } of durationFields) {
      if (bodyVal !== undefined && bodyVal !== currentVal) {
        const existing = await prisma.taskDurationAudit.findFirst({
          where: { taskId: id, field, auditDate: today },
        });
        if (existing) {
          await prisma.taskDurationAudit.update({
            where: { id: existing.id },
            data: { newValue: bodyVal },
          });
        } else {
          await prisma.taskDurationAudit.create({
            data: {
              taskId: id,
              field,
              oldValue: currentVal ?? "Working",
              newValue: bodyVal,
              auditDate: today,
            },
          });
        }
      }
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error(`Error updating task ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    await prisma.task.update({
      where: { id },
      data: { active: false },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id } = await params;
    console.error(`Error deactivating task ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to deactivate task" },
      { status: 500 },
    );
  }
}
