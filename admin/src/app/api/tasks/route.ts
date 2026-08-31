import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { SUMMARY_STATUS_SECTIONS, buildStatusCounts } from "@/lib/taskSummary";

// Only the columns the My Tasks summary tables actually render.
const SUMMARY_TASK_INCLUDE = {
  client: true,
  ownerShipBy: true,
  assignedTo: true,
  category: true,
} satisfies Prisma.TaskInclude;

// Only the relation columns the task list actually renders. Pulling the whole
// related row for six relations was most of this endpoint's payload; `createdBy`
// and `legislation` were fetched but never read by the table at all.
const TASK_LIST_INCLUDE = {
  client: {
    select: {
      id: true,
      clientType: true,
      firstName: true,
      lastName: true,
      organizationName: true,
      email: true,
    },
  },
  ownerShipBy: { select: { id: true, name: true, agentType: true, status: true } },
  assignedTo: { select: { id: true, name: true, agentType: true, status: true } },
  category: { select: { id: true, name: true, status: true } },
} satisfies Prisma.TaskInclude;

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
      followUpDuration,
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
        followUpDuration: followUpDuration || "Working",
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

    const today = new Date().toISOString().slice(0, 10);
    const initialDurationAudits = [
      {
        field: "followUpDuration",
        value: newTask.followUpDuration || "Working",
      },
      {
        field: "statusCheckDuration",
        value: newTask.statusCheckDuration || "Working",
      },
    ] as const;

    await prisma.taskDurationAudit.createMany({
      data: initialDurationAudits.map(({ field, value }) => ({
        taskId: newTask.id,
        field,
        oldValue: "Working",
        newValue: value,
        auditDate: today,
      })),
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
    const retainershipId = searchParams.get("retainershipId");
    const status = searchParams.get("status");
    const trigger = searchParams.get("trigger");
    const retainershipTasks = searchParams.get("retainershipTasks");
    const clientUpdateFilter = searchParams.get("clientUpdate");
    const statusCheckDurationParam = searchParams.get("statusCheckDuration");
    const search = searchParams.get("search");
    const prioritiesParam = searchParams.get("priorities");
    const followUpDurationsParam = searchParams.get("followUpDurations");
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
      // Legislation tasks stay visible even while their service awaits
      // approval, so admin counts match the agent's legislation view. The
      // row is flagged in the UI via `category.status` rather than dropped.
      whereClause = {
        AND: [
          {
            OR: [
              { category: null },
              { category: { status: "approved" } },
              { legislationId: { not: null } },
            ],
          },
        ],
      };
    }
    if (assignedToId) {
      whereClause.assignedToId = assignedToId;
    }
    if (trigger === "true") {
      whereClause.legislationId = { not: null };
      whereClause.OR = [
        { active: false },
        { status: "Completed" },
        { status: "completed" },
      ];
    } else if (retainershipTasks === "true") {
      whereClause.legislationId = { not: null };
      whereClause.active = true;

      if (!statusesArray?.length && !status) {
        whereClause.status = { notIn: ["Completed", "completed"] };
      }
    } else if (!categoryId) {
      // Default assigned-task view: exclude legislation/retainership tasks
      whereClause.legislationId = null;
    }
    if (clientId) {
      whereClause.clientId = clientId;
    }
    if (retainershipId) {
      whereClause.retainershipId = retainershipId;
    }
    if (statusesArray && statusesArray.length > 0) {
      whereClause.status = { in: statusesArray };
    } else if (status) {
      whereClause.status = status;
    }
    if (prioritiesParam) {
      const prioritiesArray = prioritiesParam
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (prioritiesArray.length > 0)
        whereClause.priority = { in: prioritiesArray };
    }
    if (followUpDurationsParam) {
      const followUpArray = followUpDurationsParam
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      if (followUpArray.length > 0)
        whereClause.followUpDuration = { in: followUpArray };
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

    if (search) {
      appendAndFilter({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            client: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { organizationName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          { assignedTo: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const finalWhere =
      trigger === "true"
        ? { ...whereClause }
        : { ...whereClause, active: true };

    // Summary mode: the My Tasks dashboard only renders the newest few rows per
    // status plus the headline counts, so fetch exactly that instead of every
    // task. `limit` is the per-status row cap.
    if (searchParams.get("summary") === "true") {
      const limit = Math.min(
        Math.max(parseInt(searchParams.get("limit") || "5", 10) || 5, 1),
        50,
      );

      console.log(finalWhere);

      const [groups, sections] = await Promise.all([
        prisma.task.groupBy({
          by: ["status"],
          where: finalWhere,
          _count: { _all: true },
        }),
        Promise.all(
          SUMMARY_STATUS_SECTIONS.map(async ({ key, statuses }) => ({
            key,
            tasks: await prisma.task.findMany({
              where: { ...finalWhere, status: { in: [...statuses] } },
              include: SUMMARY_TASK_INCLUDE,
              orderBy: { createdAt: "desc" },
              take: limit,
            }),
          })),
        ),
      ]);

      return NextResponse.json({
        counts: buildStatusCounts(groups),
        sections: Object.fromEntries(sections.map((s) => [s.key, s.tasks])),
      });
    }

    const taskQuery = {
      where: finalWhere,
      include: TASK_LIST_INCLUDE,
      orderBy: {
        createdAt: "desc",
      },
    } satisfies Prisma.TaskFindManyArgs;

    // Paginated mode is opt-in: callers that pass `page` (or `limit`) get
    // `{ tasks, total, page, limit, totalPages }`, everyone else still gets the
    // bare array they already expect. Without this the route serialised every
    // matching task — ~1100 rows / 5.5MB once a status filter was cleared,
    // which is what tipped the deployed function over its response limit.
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    if (pageParam || limitParam) {
      const limit = Math.min(
        Math.max(parseInt(limitParam || "20", 10) || 20, 1),
        200,
      );
      const page = Math.max(parseInt(pageParam || "1", 10) || 1, 1);

      const [total, tasks] = await Promise.all([
        prisma.task.count({ where: finalWhere }),
        prisma.task.findMany({
          ...taskQuery,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    const tasks = await prisma.task.findMany(taskQuery);
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
