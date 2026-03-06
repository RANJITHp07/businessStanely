import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";

import { Prisma } from "@prisma/client";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get URL search params for filtering
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const categoryId = searchParams.get("categoryId");
    const trigger = searchParams.get("trigger");

    // If categoryId is present, return all tasks for that category (regardless of assignment)
    // If assignedToId is present, return all tasks for that agent
    // Otherwise, only show tasks Ownership to this agent
    let where: Prisma.TaskWhereInput;
    const assignedToId = searchParams.get("assignedToId");
    const retainershipTasks = searchParams.get("retainershipTasks");
    if (categoryId) {
      where = { categoryId };
    } else if (trigger === "true") {
      where = {
        assignedToId: agent.id,
        active: false,
        OR: [
          {
            retainershipId: {
              not: null,
            },
          },
          {
            legislationId: {
              not: null,
            },
          },
        ],

        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
        ],
      };
    } else if (retainershipTasks === "true") {
      where = {
        assignedToId: agent.id,
        OR: [
          {
            retainershipId: {
              not: null,
            },
          },
          {
            legislationId: {
              not: null,
            },
          },
        ],

        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
        ],
      };
    } else {
      where = {
        assignedToId: agent.id,
        legislationId: {
          equals: null,
        },
        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
        ],
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
      where: {
        ...where,
        ...(trigger === "true" ? { active: false } : { active: true }),
      },
      include: {
        legislation: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            clientType: true,
            email: true,
          },
        },
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
      recurring: task.recurring,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      client: task.client
        ? {
            id: task.client.id,
            name:
              task.client.clientType === "individual"
                ? `${task.client.firstName} ${task.client.lastName}`.trim()
                : task.client.organizationName,
            type: task.client.clientType,
            email: task.client.email,
          }
        : null,
      category: task.category,
      createdBy: task.createdBy,
      assignedTo: task.assignedTo,
      commentsCount: task.comments.length,
      recentComments: task.comments,
      followUpDuration: task.followUpDuration,
      statusCheckDuration: task.statusCheckDuration,
      legislation: task?.legislation,
    }));

    return NextResponse.json({
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      legislationId,
      recurring,
      triggerDate, // Added triggerDate to destructured fields
      recurringType,
      active,
    } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (recurring && recurring !== "0" && !triggerDate) {
      return NextResponse.json(
        { error: "Trigger Date is required for recurring tasks" },
        { status: 400 },
      );
    }

    const recurringValue =
      recurring && recurring !== "0" ? parseInt(recurring) : null;
    const taskDueDate = dueDate ? new Date(dueDate) : null;
    const taskTriggerDate = triggerDate ? new Date(triggerDate) : null;

    console.log(recurringValue);
    // Create new task
    const newTask = await prisma.task.create({
      data: {
        title,
        ownerShipId: agent.id,
        description: description || null,
        status: status || "To Do",
        priority: priority || "Medium",
        dueDate: taskDueDate,
        triggerDate: taskTriggerDate, // Save triggerDate
        clientId: clientId || null,
        createdById: agent.id,
        assignedToId: assignedToId || agent.id,
        categoryId: categoryId || null,
        legislationId: legislationId || null, // Save legislationId
        recurring: recurringValue, // Save recurring field
        recurringType,
        active,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            clientType: true,
            email: true,
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

    // Initialize recurring fields if this is a recurring task
    if (recurringValue && taskDueDate) {
      try {
        const { initializeRecurringTask } =
          await import("@/lib/singleTaskRecurring");
        await initializeRecurringTask(newTask.id, recurringValue, taskDueDate);
      } catch (error) {
        console.error("Error initializing recurring task:", error);
      }
    }

    // Format task for frontend
    const taskWithFields = newTask as typeof newTask & TaskWithAdditionalFields;
    const formattedTask = {
      id: newTask.id,
      title: newTask.title,
      description: newTask.description,
      status: newTask.status,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      triggerDate: newTask.triggerDate || null, // Ensure triggerDate is included
      progress: taskWithFields.progress,
      followUpRequired: taskWithFields.followUpRequired,
      completed: taskWithFields.completed,
      recurring: newTask.recurring,
      createdAt: newTask.createdAt,
      updatedAt: newTask.updatedAt,
      client: newTask.client
        ? {
            id: newTask.client.id,
            name:
              newTask.client.clientType === "individual"
                ? `${newTask.client.firstName} ${newTask.client.lastName}`.trim()
                : newTask.client.organizationName,
            type: newTask.client.clientType,
            email: newTask.client.email,
          }
        : null,
      category: null, // Will be fetched separately if needed
      createdBy: newTask.createdBy
        ? {
            id: newTask.createdBy.id,
            name: newTask.createdBy.name,
            email: newTask.createdBy.email,
          }
        : null,
      assignedTo: newTask.assignedTo
        ? {
            id: newTask.assignedTo.id,
            name: newTask.assignedTo.name,
            email: newTask.assignedTo.email,
          }
        : null,
      commentsCount: 0,
      recentComments: [],
    };

    return NextResponse.json(
      {
        message: "Task created successfully",
        task: formattedTask,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
