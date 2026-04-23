import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      clientId,
      createdById,
      assignedToId,
      categoryId,
      legislationId,
      recurring,
      recurringType,
      triggerDate,
      active,
      statusCheckDuration,
    } = body;

    if (!title || !createdById) {
      return NextResponse.json(
        { error: "Title and createdById are required" },
        { status: 400 },
      );
    }

    const recurringValue =
      recurring && recurring !== "0" ? parseInt(recurring) : null;
    const taskDueDate = dueDate ? new Date(dueDate) : null;
    const taskTriggerDate = triggerDate ? new Date(triggerDate) : null;

    const newTask = await prisma.task.create({
      data: {
        title,
        ownerShipId: assignedToId!,
        description,
        status,
        priority,
        dueDate: taskDueDate,
        triggerDate: taskTriggerDate,
        clientId,
        createdById,
        assignedToId,
        categoryId: categoryId || undefined,
        legislationId: legislationId || null, // Save legislationId
        recurring: recurringValue, // Save recurring field
        recurringType,
        statusCheckDuration: statusCheckDuration || "48hr",
        active,
      },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
      },
    });

    // Initialize recurring fields if this is a recurring task
    if (recurringValue && dueDate) {
      try {
        const { initializeRecurringTask } =
          await import("@/lib/singleTaskRecurring");
        await initializeRecurringTask(
          newTask.id,
          recurringValue,
          new Date(dueDate),
        );
      } catch (error) {
        console.error("Error initializing recurring task:", error);
      }
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
    }
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignedToId = searchParams.get("assignedToId");
    const clientId = searchParams.get("clientId");
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status");
    const trigger = searchParams.get("trigger");
    const retainershipTasks = searchParams.get("retainershipTasks");
    const clientUpdateFilter = searchParams.get("clientUpdate");
    const statusCheckDurationParam = searchParams.get("statusCheckDuration");
    // Parse statuses as a comma-separated list
    const statusesParam = searchParams.get("statuses");
    const statusesArray = statusesParam
      ? statusesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const statusCheckDurations = statusCheckDurationParam
      ? statusCheckDurationParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => ["24hr", "48hr", "1w"].includes(s))
      : undefined;

    // Build the where clause: if filtering by categoryId, allow any status; otherwise, only approved
    let whereClause: Prisma.TaskWhereInput;
    if (categoryId) {
      whereClause = { categoryId };
    } else {
      whereClause = {
        AND: [
          { OR: [{ category: null }, { category: { status: "approved" } }] },
        ],
      };
    }
    if (assignedToId) {
      whereClause.assignedToId = assignedToId;
    } else {
      whereClause.active = true;
    }
    if (trigger === "true") {
      whereClause.legislationId = { not: null };
      whereClause.OR = [{ active: false }, { status: "Completed" }];
    } else if (retainershipTasks === "true") {
      whereClause.legislationId = { not: null };
      whereClause.active = true;

      if (!statusesArray?.length && !status) {
        whereClause.status = { notIn: ["Completed", "completed"] };
      }
    }
    if (clientId) {
      whereClause.clientId = clientId;
    }
    if (statusesArray && statusesArray.length > 0) {
      whereClause.status = { in: statusesArray };
    } else if (status) {
      whereClause.status = status;
    }

    const appendAndFilter = (filter: Prisma.TaskWhereInput) => {
      const currentAnd = whereClause.AND;
      if (!currentAnd) {
        whereClause.AND = [filter];
        return;
      }

      if (Array.isArray(currentAnd)) {
        whereClause.AND = [...currentAnd, filter];
        return;
      }

      whereClause.AND = [currentAnd, filter];
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
      where: { ...whereClause },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
        legislation: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to fetch tasks", details: errorMessage },
      { status: 500 },
    );
  }
}
