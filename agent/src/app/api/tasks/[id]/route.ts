import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface TaskWithFields {
  categoryId?: string;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { id: taskId } = await params;
    // Only allow delete if agent is creator or assigned
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: agent.id },
          { assignedToId: agent.id },
        ],
      },
    });
    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found or not authorized" },
        { status: 404 }
      );
    }
    await prisma.task.delete({ where: { id: taskId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id: taskId } = await params;
    console.error(`Error deleting task ${taskId}:`, error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    // Fetch the specific task with full details (no assignment restriction)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
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
        where: { superiorId: task.assignedTo.id },
        include: {
          subordinate: {
            select: {
              id: true,
              name: true,
              email: true,
              photo: true,
            }
          }
        }
      });
      assignedAgentSubordinates = subLinks.map(link => {
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
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Fetch category separately if needed
    let category = null;
    const taskWithFields = task as typeof task & TaskWithFields;
    if (taskWithFields.categoryId) {
      category = await prisma.taskCategory.findUnique({
        where: { id: taskWithFields.categoryId },
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
        },
      });
    }

    return NextResponse.json({
      task: {
        ...task,
        assignedTo: task?.assignedTo
          ? { ...task.assignedTo, subordinates: assignedAgentSubordinates }
          : null,
        category
      }
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;
    const body = await req.json();

    // Verify the task exists and agent has access
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: agent.id },
          { assignedToId: agent.id },
        ],
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }



    // Transform relation IDs to nested connect objects for Prisma
  const updateData: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    };
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
    // Handle recurring field conversion
    if (updateData.recurring) {
      const recurringValue = updateData.recurring as string;
      updateData.recurring = recurringValue && recurringValue !== "0" ? parseInt(recurringValue) : null;
    }
    // Remove any frontend-only fields
    delete updateData.legislationName;

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

    // Check if task is transitioning from not completed to completed and has recurring setting
    // Recurring tasks are handled automatically by calendar schedule via cron job
    // No action needed on completion - the daily automation will update due dates based on calendar

    // Fetch category separately if needed
    let category = null;
    const updatedTaskWithFields = updatedTask as typeof updatedTask & TaskWithFields;
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

    return NextResponse.json({
      task: {
        ...updatedTask,
        category
      }
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
