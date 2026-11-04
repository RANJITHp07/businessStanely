import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { categorySearchConditions, parsePagination } from "@/lib/taskCategoryList";

// GET /api/task-categories - Get all task categories
function describeCreator(category: {
  createdByUser: { username: string; adminType: string } | null;
  createdByAgent: { name: string } | null;
}) {
  if (category.createdByUser) {
    return {
      createdBy: category.createdByUser.username,
      createdByType: "user",
      createdByRole: category.createdByUser.adminType, // "owner" or "admin"
    };
  }
  if (category.createdByAgent) {
    return {
      createdBy: category.createdByAgent.name,
      createdByType: "agent",
      createdByRole: null,
    };
  }
  return { createdBy: null, createdByType: null, createdByRole: null };
}

export async function GET(req: NextRequest) {
  try {
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const includeAll = url.searchParams.get("includeAll") === "true";
    // `lite=true` returns only id/name for pickers such as the task list's
    // service filter, skipping the relations and per-category task counts.
    const lite = url.searchParams.get("lite") === "true";

    // Build where clause for the query
    const where: { status?: string | { not: string } } = {};

    // If status parameter is provided, filter by specific status
    if (
      statusParam &&
      ["approved", "pending", "rejected"].includes(statusParam)
    ) {
      where.status = statusParam;
    } else if (includeAll) {
      // Show all categories including rejected (for admin purposes)
      // No status filter
    } else {
      // Default: exclude rejected categories for task creation/selection
      where.status = { not: "rejected" };
    }

    if (lite) {
      const categories = await prisma.taskCategory.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(categories);
    }

    // Paginated mode for the services table: one page of its columns, with task
    // counts for that page only. Other callers still get the full list.
    if (url.searchParams.has("page")) {
      const { page, limit, skip } = parsePagination(url.searchParams);
      const search = url.searchParams.get("search")?.trim();
      const listWhere: Prisma.TaskCategoryWhereInput = search
        ? { ...where, OR: await categorySearchConditions(search) }
        : where;

      const [rows, total, statusGroups] = await Promise.all([
        prisma.taskCategory.findMany({
          where: listWhere,
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            createdByUser: { select: { username: true, adminType: true } },
            createdByAgent: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.taskCategory.count({ where: listWhere }),
        // The tab labels count every service, whatever the search or page.
        prisma.taskCategory.groupBy({
          by: ["status"],
          where: { status: { not: "rejected" } },
          _count: { _all: true },
        }),
      ]);

      const pageTaskGroups = await prisma.task.groupBy({
        by: ["categoryId"],
        where: { categoryId: { in: rows.map((row) => row.id) } },
        _count: { _all: true },
      });
      const pageTaskCounts = new Map(
        pageTaskGroups.map((group) => [group.categoryId, group._count._all]),
      );

      return NextResponse.json({
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description || "",
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          ...describeCreator(row),
          taskCount: pageTaskCounts.get(row.id) ?? 0,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        counts: Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])),
      });
    }

    const categories = await prisma.taskCategory.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
        createdByAgentId: true,
        approvedById: true,
        approvedAt: true,
        timePeriod: true,
        agentCanEditDays: true,
        createdByUser: { select: { username: true, adminType: true } },
        createdByAgent: { select: { name: true } },
        approvedBy: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // One grouped count for every category, rather than a query per category.
    const taskGroups = await prisma.task.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: categories.map((category) => category.id) } },
      _count: { _all: true },
    });
    const taskCountById = new Map(
      taskGroups.map((group) => [group.categoryId, group._count._all]),
    );

    // Transform data for frontend
    const transformedCategories = categories.map((category) => {
      const taskCount = taskCountById.get(category.id) ?? 0;
        return {
          id: category.id,
          name: category.name,
          description: category.description || "",
          color: category.color,
          status: category.status,
          createdAt: category.createdAt.toISOString(),
          updatedAt: category.updatedAt.toISOString(),
          ...describeCreator(category),
          createdById: category.createdByUserId || category.createdByAgentId,
          approvedById: category.approvedById || null,
          approvedBy: category.approvedBy?.username || null,
          approvedAt: category.approvedAt?.toISOString() || null,
          taskCount: taskCount,
          isOwner: false,
          timePeriod: category.timePeriod,
          agentCanEditDays: category.agentCanEditDays ?? false,
        };
    });

    return NextResponse.json(transformedCategories);
  } catch (error) {
    console.error("Error fetching task categories:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/task-categories - Create a new task category
export async function POST(req: NextRequest) {
  try {
    // Get the current agent user
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { name, description, color, timePeriod, notes, processFlow } = body; // Include notes, processFlow

    // Convert timePeriod to an integer
    const parsedTimePeriod = timePeriod ? parseInt(timePeriod, 10) : null;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // All agent-created categories are pending and not approved
    const newCategory = await prisma.taskCategory.create({
      data: {
        name,
        description: description || "",
        notes: notes || "",
        processFlow: processFlow || "",
        color: color || "blue",
        timePeriod: parsedTimePeriod, // Use parsed integer value
        status: "pending",
        createdByAgentId: currentAgent.id,
        approvedById: null,
        approvedAt: null,
      },
      include: {
        createdByAgent: {
          select: {
            id: true,
            name: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Send notification email to all admins/owners
    try {
      const { sendAdminOwnerNotification } = await import("@/lib/email");
      await sendAdminOwnerNotification({
        subject: `New Service Created: ${newCategory.name}`,
        html: `<p>A new service has been created by agent <b>${
          currentAgent.name
        }</b>.<br><br><b>Service Name:</b> ${
          newCategory.name
        }<br><b>Description:</b> ${newCategory.description || "-"}</p>`,
        text: `A new service has been created by agent ${
          currentAgent.name
        }.\nService Name: ${newCategory.name}\nDescription: ${
          newCategory.description || "-"
        }`,
      });
    } catch (e) {
      console.error("Failed to send admin/owner notification email:", e);
    }

    // Transform data for frontend
    const transformedCategory = {
      id: newCategory.id,
      name: newCategory.name,
      description: newCategory.description || "",
      color: newCategory.color,
      status: newCategory.status,
      createdAt: newCategory.createdAt.toISOString(),
      updatedAt: newCategory.updatedAt.toISOString(),
      createdBy: newCategory.createdByAgent?.name || null,
      createdById: newCategory.createdByAgentId,
      approvedById: newCategory.approvedById,
      approvedBy: newCategory.approvedBy?.username || null,
      approvedAt: newCategory.approvedAt?.toISOString() || null,
      taskCount: 0,
      timePeriod: newCategory.timePeriod, // Include timePeriod in the response
    };

    return NextResponse.json(transformedCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating task category:", error);

    // Check for unique constraint violations - Prisma error
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
