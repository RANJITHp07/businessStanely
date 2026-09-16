import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { onlyDeleted } from "@/lib/softDelete";

/**
 * GET /api/deleted-task-categories — soft-deleted services, newest deletion
 * first.
 *
 * Deleting a service cascades the soft delete to its tasks, so the task count
 * here is of rows hidden *with* the service. It is read with `onlyDeleted` for
 * that reason: the default read path would report zero for every one of them.
 */
export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await prisma.taskCategory.findMany({
      where: onlyDeleted,
      orderBy: { deletedAt: "desc" },
      include: {
        createdByUser: { select: { id: true, username: true, adminType: true } },
        createdByAgent: { select: { id: true, name: true } },
      },
    });

    const categoryIds = categories.map((category) => category.id);

    const taskGroups = categoryIds.length
      ? await prisma.task.groupBy({
          by: ["categoryId"],
          where: { categoryId: { in: categoryIds }, ...onlyDeleted },
          _count: { _all: true },
        })
      : [];

    const taskCountById = new Map<string, number>();
    for (const group of taskGroups) {
      if (!group.categoryId) continue;
      taskCountById.set(group.categoryId, group._count._all);
    }

    // The row carries only deletedById/deletedByType, so the deleter's name is
    // resolved separately — it can be either a user or an agent.
    const deletedUserIds = [
      ...new Set(
        categories
          .filter((c) => c.deletedByType === "USER" && c.deletedById)
          .map((c) => c.deletedById as string)
      ),
    ];
    const deletedAgentIds = [
      ...new Set(
        categories
          .filter((c) => c.deletedByType === "AGENT" && c.deletedById)
          .map((c) => c.deletedById as string)
      ),
    ];

    const [deletedUsers, deletedAgents] = await Promise.all([
      deletedUserIds.length
        ? prisma.user.findMany({
            where: { id: { in: deletedUserIds } },
            select: { id: true, username: true },
          })
        : Promise.resolve([]),
      deletedAgentIds.length
        ? prisma.agent.findMany({
            where: { id: { in: deletedAgentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const deleterNameById = new Map<string, string>();
    for (const user of deletedUsers) deleterNameById.set(user.id, user.username);
    for (const agent of deletedAgents) deleterNameById.set(agent.id, agent.name);

    return NextResponse.json(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description || "",
        color: category.color,
        status: category.status,
        createdAt: category.createdAt.toISOString(),
        deletedAt: category.deletedAt?.toISOString() || null,
        deletedByType: category.deletedByType,
        deletedBy: category.deletedById
          ? deleterNameById.get(category.deletedById) || null
          : null,
        createdBy:
          category.createdByUser?.username ||
          category.createdByAgent?.name ||
          null,
        createdByType: category.createdByUser
          ? "user"
          : category.createdByAgent
          ? "agent"
          : null,
        createdByRole: category.createdByUser?.adminType || null,
        timePeriod: category.timePeriod,
        taskCount: taskCountById.get(category.id) || 0,
      }))
    );
  } catch (error) {
    console.error("Error fetching deleted services:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted services" },
      { status: 500 }
    );
  }
}
