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
    const { id: taskId } = params;
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
    console.error(`Error deleting task ${params.id}:`, error);
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

    // Fetch the specific task with full details
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: agent.id },
          { assignedToId: agent.id },
        ],
      },
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
            subordinatesLinks: {
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
            }
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
        legislation: true, // Added legislation relation
      },
    });

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
      },
    });

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
