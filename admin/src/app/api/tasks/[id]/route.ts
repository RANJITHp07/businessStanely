import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
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
        } else if (key === "recurringType") {
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
      } else {
        const interval =
          data.recurring !== undefined ? data.recurring : currentTask.recurring;
        if (interval === null || interval === undefined) {
          data.recurring = null;
          data.recurringType = null;
        } else {
          data.recurring = interval;
          data.recurringType = normalizedType;
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

    // Extend due date if status is set to "Hold"
    if (body.status === "Hold" && currentTask.dueDate) {
      data.holdDate = new Date();
    }
    if (body.status === "Completed") {
      if (currentTask.status !== "Completed") {
        data.lastCompletedDate = new Date();
      }
    } else if (
      body.status !== undefined &&
      currentTask.status === "Completed"
    ) {
      data.lastCompletedDate = null;
    }
    let updatedTask = await prisma.task.update({
      where: { id },
      data,
    });

    // The next deadline is derived from triggerDate + the service's timePeriod,
    // so editing either side of that formula has to recompute it. Without this
    // an edited task keeps the deadline of its old trigger date or old service
    // until the cron next rolls it forward.
    if (
      body.triggerDate !== undefined ||
      body.dueDate !== undefined ||
      body.categoryId !== undefined
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
