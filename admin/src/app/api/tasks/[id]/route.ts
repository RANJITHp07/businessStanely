import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
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
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Get the current task to check if it's being marked as completed
    const currentTask = await prisma.task.findUnique({
      where: { id },
    });
    
    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    
    // Only pick allowed fields from body, now including statusProgressMap
    const allowedFields = [
      "title", "description", "status", "priority", "dueDate", "progress", "followUpRequired", "completed", "recurring",
      "followUpDuration", "statusCheckDuration", "statusProgressMap"
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === "recurring") {
          // Handle recurring field conversion
          const recurringValue = body[key] as string;
          data[key] = recurringValue && recurringValue !== "0" ? parseInt(recurringValue) : null;
        } else if (key === "statusProgressMap") {
          // Ensure statusProgressMap is stored as JSON
          data[key] = body[key];
        } else {
          data[key] = body[key];
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
    if (body.categoryId) {
      data.category = { connect: { id: body.categoryId } };
    }
    if (body.legislationId) {
      data.legislation = { connect: { id: body.legislationId } };
    }
    
    const updatedTask = await prisma.task.update({
      where: { id },
      data,
    });
    
    // Check if task is transitioning from not completed to completed and has recurring setting
    // Recurring tasks are handled automatically by calendar schedule via cron job
    // No action needed on completion - the daily automation will update due dates based on calendar
    
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error(`Error updating task ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    await prisma.task.delete({
      where: { id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id } = await params;
    console.error(`Error deleting task ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}