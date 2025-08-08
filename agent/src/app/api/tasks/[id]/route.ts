import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";



interface TaskWithFields {
  categoryId?: string;
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
            subordinates: {
              select: {
                id: true,
                name: true,
                email: true,
                photo: true,
              },
            },
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


    // Allow updating assignedToId for reassignment
    const updateData: Partial<{
      status: string;
      progress: number;
      followUpRequired: boolean;
      completed: boolean;
      assignedToId: string;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.progress !== undefined) {
      updateData.progress = body.progress;
    }
    if (body.followUpRequired !== undefined) {
      updateData.followUpRequired = body.followUpRequired;
    }
    if (body.completed !== undefined) {
      updateData.completed = body.completed;
    }
    if (body.assignedToId !== undefined) {
      updateData.assignedToId = body.assignedToId;
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
