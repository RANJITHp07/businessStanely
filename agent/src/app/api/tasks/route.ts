import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";

import { Prisma } from '@prisma/client';
import prisma from "@/lib/prisma";

interface TaskWithAdditionalFields {
  progress?: number | null;
  followUpRequired?: boolean;
  completed?: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get URL search params for filtering
    const { searchParams } = new URL(req.url);

  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const categoryId = searchParams.get("categoryId");


    // If categoryId is present, return all tasks for that category (regardless of assignment)
    // Otherwise, only show tasks assigned to this agent
    let where: Prisma.TaskWhereInput;
    if (categoryId) {
      where = { categoryId };
    } else {
      where = {
        assignedToId: agent.id,
        AND: [
          {
            OR: [
              { category: null },
              { category: { status: 'approved' } }
            ]
          }
        ]
      };
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    // Fetch all tasks (no pagination)
    const tasks = await prisma.task.findMany({
      where,
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
        comments: {
          include: {
            user: true,
            agent: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format tasks for frontend
    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      progress: (task as TaskWithAdditionalFields).progress,
      followUpRequired: (task as TaskWithAdditionalFields).followUpRequired,
      completed: (task as TaskWithAdditionalFields).completed,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      client: task.client ? {
        id: task.client.id,
        name: task.client.clientType === "individual" 
          ? `${task.client.firstName} ${task.client.lastName}`.trim()
          : task.client.organizationName,
        type: task.client.clientType,
      } : null,
      category: task.category, 
      createdBy: task.createdBy,
      assignedTo: task.assignedTo,
      commentsCount: task.comments.length,
      recentComments: task.comments,
    }));

    return NextResponse.json({
      tasks: formattedTasks,
    });

  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      clientId,
      assignedToId,
      categoryId,
    } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Create new task
    const newTask = await prisma.task.create({
      data: {
        title,
        description: description || null,
        status: status || "To Do",
        priority: priority || "Medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        clientId: clientId || null,
        createdById: agent.id,
        assignedToId: assignedToId || agent.id,
        categoryId: categoryId || null,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            clientType: true,
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
          },
        },
      },
    });

    // Format task for frontend
    const taskWithFields = newTask as typeof newTask & TaskWithAdditionalFields;
    const formattedTask = {
      id: newTask.id,
      title: newTask.title,
      description: newTask.description,
      status: newTask.status,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      progress: taskWithFields.progress,
      followUpRequired: taskWithFields.followUpRequired,
      completed: taskWithFields.completed,
      createdAt: newTask.createdAt,
      updatedAt: newTask.updatedAt,
      client: newTask.client ? {
        id: newTask.client.id,
        name: newTask.client.clientType === "individual" 
          ? `${newTask.client.firstName} ${newTask.client.lastName}`.trim()
          : newTask.client.organizationName,
        type: newTask.client.clientType,
      } : null,
      category: null, // Will be fetched separately if needed
      createdBy: newTask.createdBy,
      assignedTo: newTask.assignedTo,
      commentsCount: 0,
      recentComments: [],
    };

    return NextResponse.json({
      message: "Task created successfully",
      task: formattedTask,
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
