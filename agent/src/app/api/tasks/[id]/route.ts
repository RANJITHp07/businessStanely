import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface TaskWithFields {
  categoryId?: string;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: taskId } = await params;
    // Allow delete if agent is creator, assigned, or superior of assigned agent
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { createdById: true, assignedToId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    let isAuthorized = false;
    if (task.createdById === agent.id || task.assignedToId === agent.id) {
      isAuthorized = true;
    } else if (task.assignedToId) {
      // Check if agent is a superior of the assigned agent
      const superiorLink = await prisma.agentSuperior.findFirst({
        where: {
          superiorId: agent.id,
          subordinateId: task.assignedToId,
        },
      });
      if (superiorLink) isAuthorized = true;
    }
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Not authorized to delete this task" },
        { status: 403 },
      );
    }
    await prisma.task.delete({ where: { id: taskId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id: taskId } = await params;
    console.error(`Error deleting task ${taskId}:`, error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;

    // Fetch the specific task with full details (no assignment restriction)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        ownerShipBy: true,
        client: {
          select: {
            id: true,
            clientType: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            email: true,
            phoneNumber: true,
            secondaryPhoneNumber: true,
            address: true,
            authorizedPersonName: true,
            designation: true,
            contactEmail: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            photo: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            agent: {
              select: {
                id: true,
                name: true,
              },
            },
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
              },
            },
          },
          orderBy: {
            date: "desc",
          },
        },
        legislation: true,
        category: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          },
        },
      },
    });

    // Fetch subordinates for assigned agent (team members)
    interface TeamMember {
      id: string;
      name: string;
      email: string;
      photo?: string;
    }
    let assignedAgentSubordinates: TeamMember[] = [];
    if (task?.assignedTo?.id) {
      const subLinks = await prisma.agentSuperior.findMany({
        where: {
          superiorId: task.assignedTo.id,
          subordinate: { status: "active" },
        },
        include: {
          subordinate: {
            select: {
              id: true,
              name: true,
              email: true,
              photo: true,
            },
          },
        },
      });
      assignedAgentSubordinates = subLinks.map((link) => {
        const { id, name, email, photo } = link.subordinate;
        return {
          id,
          name,
          email,
          photo: photo === null ? undefined : photo,
        };
      });
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      task: {
        ...task,
        assignedTo: task?.assignedTo
          ? { ...task.assignedTo, subordinates: assignedAgentSubordinates }
          : null,
        service: task.category ? [task.category] : [], // Map category to service field
      },
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const body = await req.json();

    // Allow update if agent is creator, assigned, or superior of assigned agent
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        createdById: true,
        assignedToId: true,
        dueDate: true,
        status: true,
        followUpDuration: true,
        statusCheckDuration: true,
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    let isAuthorized = false;
    if (task.createdById === agent.id || task.assignedToId === agent.id) {
      isAuthorized = true;
    } else if (task.assignedToId) {
      // Check if agent is a superior of the assigned agent
      const superiorLink = await prisma.agentSuperior.findFirst({
        where: {
          superiorId: agent.id,
          subordinateId: task.assignedToId,
        },
      });
      if (superiorLink) isAuthorized = true;
    }
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Not authorized to update this task" },
        { status: 403 },
      );
    }

    // Enforce mutual exclusivity for followUpDuration and statusCheckDuration
    let { followUpDuration, statusCheckDuration } = body;
    if (
      followUpDuration &&
      followUpDuration !== "None" &&
      statusCheckDuration &&
      statusCheckDuration !== "None"
    ) {
      // If both are non-None, prioritize the one being changed (frontend always sends both)
      // If followUpDuration is being set, set statusCheckDuration to 'None'
      statusCheckDuration = "None";
    } else if (
      statusCheckDuration &&
      statusCheckDuration !== "None" &&
      followUpDuration &&
      followUpDuration !== "None"
    ) {
      // If statusCheckDuration is being set, set followUpDuration to 'None'
      followUpDuration = "None";
    }
    // Transform relation IDs to nested connect objects for Prisma
    const updateData: Record<string, unknown> = {
      ...body,
      followUpDuration,
      statusCheckDuration,
      updatedAt: new Date(),
    };
    // Only allow statusProgressMap if present
    if (body.statusProgressMap !== undefined) {
      updateData.statusProgressMap = body.statusProgressMap;
    }
    if (updateData.clientId) {
      updateData.client = { connect: { id: updateData.clientId } };
      delete updateData.clientId;
    }
    if (updateData.assignedToId) {
      updateData.assignedTo = { connect: { id: updateData.assignedToId } };
      delete updateData.assignedToId;
    }
    if (updateData.categoryId) {
      updateData.category = { connect: { id: updateData.categoryId } };
      delete updateData.categoryId;
    }
    if (typeof updateData.legislationId === "string") {
      if (updateData.legislationId.trim()) {
        updateData.legislation = { connect: { id: updateData.legislationId } };
      }
      // Remove legislationId from updateData regardless
      delete updateData.legislationId;
    }
    if (body.status === "Hold" && task.dueDate) {
      updateData.holdDate = new Date();
    }
    // Handle recurring field conversion
    if (updateData.recurring) {
      const recurringValue = updateData.recurring as string;
      updateData.recurring =
        recurringValue && recurringValue !== "0"
          ? parseInt(recurringValue)
          : null;
    }

    if (!updateData.triggerDate) {
      delete updateData.triggerDate;
    } else {
      updateData.triggerDate = new Date(updateData?.triggerDate as string);
    }
    // Remove any frontend-only fields
    delete updateData.legislationName;

    if (body.status === "Completed") {
      if (task.status !== "Completed") {
        updateData.lastCompletedDate = new Date();
      }
    } else if (body.status !== undefined && task.status === "Completed") {
      updateData.lastCompletedDate = null;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            clientType: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            email: true,
            phoneNumber: true,
            authorizedPersonName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            timePeriod: true,
          },
        },
      },
    });

    // Upsert daily duration audit entries
    const today = new Date().toISOString().slice(0, 10);
    const durationFields = [
      {
        field: "followUpDuration",
        bodyVal: body.followUpDuration,
        currentVal: task.followUpDuration,
      },
      {
        field: "statusCheckDuration",
        bodyVal: body.statusCheckDuration,
        currentVal: task.statusCheckDuration,
      },
    ] as const;
    for (const { field, bodyVal, currentVal } of durationFields) {
      if (bodyVal !== undefined && bodyVal !== currentVal) {
        const existing = await prisma.taskDurationAudit.findFirst({
          where: { taskId, field, auditDate: today },
        });
        if (existing) {
          await prisma.taskDurationAudit.update({
            where: { id: existing.id },
            data: { newValue: bodyVal },
          });
        } else {
          await prisma.taskDurationAudit.create({
            data: {
              taskId,
              field,
              oldValue: currentVal ?? "None",
              newValue: bodyVal,
              auditDate: today,
              changedByAgentId: agent.id,
            },
          });
        }
      }
    }

    // Check if task is transitioning from not completed to completed and has recurring setting
    // Recurring tasks are handled automatically by calendar schedule via cron job
    // No action needed on completion - the daily automation will update due dates based on calendar

    // Fetch category separately if needed
    let category = null;
    const updatedTaskWithFields = updatedTask as typeof updatedTask &
      TaskWithFields;
    if (updatedTaskWithFields.categoryId) {
      category = await prisma.taskCategory.findUnique({
        where: { id: updatedTaskWithFields.categoryId },
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
        },
      });
    }

    // Check if the status is being updated to "Hold"
    if (body.status === "Hold") {
      const taskDetails = await prisma.task.findUnique({
        where: { id: taskId },
        select: { dueDate: true, updatedAt: true },
      });

      const currentDate = new Date(); // Define currentDate
      if (taskDetails?.dueDate) {
        const dueDate = new Date(taskDetails.dueDate);
        if (currentDate < dueDate) {
          const remainingDays = Math.ceil(
            (dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          updateData.dueDate = new Date(
            currentDate.getTime() + remainingDays * 24 * 60 * 60 * 1000,
          );
        }
      }
    }

    return NextResponse.json({
      task: {
        ...updatedTask,
        category,
      },
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
