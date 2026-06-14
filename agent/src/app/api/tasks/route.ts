import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

interface TaskWithAdditionalFields {
  progress?: number | null;
  followUpRequired?: boolean;
  completed?: boolean;
  recurringType?: string | null;
  triggerDate?: Date | null;
  nextDueDate?: Date | null;
  currentPeriodStart?: Date | null;
  lastCompletedDate?: Date | null;
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const assignedToId = searchParams.get("assignedToId") || agent.id;
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const categoryId = searchParams.get("categoryId");
    const trigger = searchParams.get("trigger");
    const retainershipTasks = searchParams.get("retainershipTasks");
    const clientUpdateFilter = searchParams.get("clientUpdate");
    const statusCheckDurationParam = searchParams.get("statusCheckDuration");

    const statusCheckDurations = statusCheckDurationParam
      ? statusCheckDurationParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => ["24hr", "48hr", "1w"].includes(s))
      : undefined;

    let where: Prisma.TaskWhereInput = {};

    // CATEGORY FILTER
    if (categoryId) {
      where = { categoryId, assignedToId };
    }

    // TRIGGER TASKS
    else if (trigger === "true") {
      where = {
        assignedToId,
        legislationId: { not: null },
        OR: [
          { active: false },
          { status: "Completed" },
          { status: "completed" },
        ],

        // OR: [
        //   { retainershipId: { not: null } },
        //   { legislationId: { not: null } },
        // ],
        // AND: [
        //   {
        //     OR: [
        //       { categoryId: null },
        //       { category: { is: { status: "approved" } } },
        //     ],
        //   },
        // ],
      };
    }

    // RETAINERSHIP TASKS
    else if (retainershipTasks === "true") {
      where = {
        assignedToId,
        active: true,
        legislationId: { not: null },
        // OR: [
        //   { retainershipId: { not: null } },
        //   { legislationId: { not: null } },
        // ],
        // AND: [
        //   {
        //     OR: [
        //       { categoryId: null },
        //       { category: { is: { status: "approved" } } },
        //     ],
        //   },
        // ],
      };
    }

    // DEFAULT TASKS
    else {
      where = {
        assignedToId,
        legislation: null,
        // category: {
        //   is: {
        //     status: "approved",
        //   },
        // },
      };
    }

    // OPTIONAL FILTERS
    if (status) {
      where.status = status;
    } else if (retainershipTasks === "true") {
      where.status = { notIn: ["Completed", "completed"] };
    }

    if (priority) {
      where.priority = priority;
    }

    const appendAndFilter = (filter: Prisma.TaskWhereInput) => {
      const currentAnd = where.AND;
      if (!currentAnd) {
        where.AND = [filter];
        return;
      }

      if (Array.isArray(currentAnd)) {
        where.AND = [...currentAnd, filter];
        return;
      }

      where.AND = [currentAnd, filter];
    };

    if (
      clientUpdateFilter === "updated" ||
      clientUpdateFilter === "not-updated"
    ) {
      const durationsToCheck =
        statusCheckDurations && statusCheckDurations.length > 0
          ? statusCheckDurations
          : ["24hr", "48hr", "1w"];

      const now = Date.now();
      const durationCutoffs = {
        "24hr": new Date(now - 24 * 60 * 60 * 1000),
        "48hr": new Date(now - 48 * 60 * 60 * 1000),
        "1w": new Date(now - 7 * 24 * 60 * 60 * 1000),
      } as const;

      const durationFilters = durationsToCheck.map((duration) => {
        const cutoff =
          durationCutoffs[duration as keyof typeof durationCutoffs];
        return clientUpdateFilter === "updated"
          ? {
              statusCheckDuration: duration,
              OR: [
                {
                  comments: {
                    some: {
                      createdAt: {
                        gte: cutoff,
                      },
                    },
                  },
                },
                {
                  AND: [
                    {
                      comments: {
                        none: {},
                      },
                    },
                    {
                      createdAt: {
                        gte: cutoff,
                      },
                    },
                  ],
                },
              ],
            }
          : {
              statusCheckDuration: duration,
              AND: [
                {
                  comments: {
                    none: {
                      createdAt: {
                        gte: cutoff,
                      },
                    },
                  },
                },
                {
                  OR: [
                    {
                      comments: {
                        some: {},
                      },
                    },
                    {
                      createdAt: {
                        lt: cutoff,
                      },
                    },
                  ],
                },
              ],
            };
      });

      appendAndFilter({ OR: durationFilters });
    }

    const tasks = await prisma.task.findMany({
      where: trigger === "true" ? where : { ...where, active: true },
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
        ownerShipBy: true,
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
      recurringType: (task as TaskWithAdditionalFields).recurringType,
      triggerDate: (task as TaskWithAdditionalFields).triggerDate,
      nextDueDate: (task as TaskWithAdditionalFields).nextDueDate,
      currentPeriodStart: (task as TaskWithAdditionalFields).currentPeriodStart,
      lastCompletedDate: (task as TaskWithAdditionalFields).lastCompletedDate,
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
      ownerShipBy: task.ownerShipBy,
      assignedTo: task.assignedTo,
      commentsCount: task.comments.length,
      recentComments: task.comments,
      followUpDuration: task.followUpDuration,
      statusCheckDuration: task.statusCheckDuration,
      legislation: task.legislation,
    }));

    console.log(formattedTasks.length, tasks.length);

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
      followUpDuration,
      statusCheckDuration,
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
        followUpDuration: followUpDuration || "None",
        statusCheckDuration: statusCheckDuration || "48hr",
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

    const today = new Date().toISOString().slice(0, 10);
    const initialDurationAudits = [
      {
        field: "followUpDuration",
        value: newTask.followUpDuration || "None",
      },
      {
        field: "statusCheckDuration",
        value: newTask.statusCheckDuration || "None",
      },
    ] as const;

    await prisma.taskDurationAudit.createMany({
      data: initialDurationAudits.map(({ field, value }) => ({
        taskId: newTask.id,
        field,
        oldValue: "None",
        newValue: value,
        auditDate: today,
      })),
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
