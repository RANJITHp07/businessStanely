import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { onlyDeleted } from "@/lib/softDelete";

/**
 * GET /api/deleted-task-categories/[id] — a deleted service plus the tasks
 * cascaded away with it.
 *
 * Both are read with `onlyDeleted`, because the delete stamps them with the
 * same `deletedAt` and the normal read paths hide all of it — which is why this
 * route exists rather than reusing /api/task-categories/[id].
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const category = await prisma.taskCategory.findFirst({
      where: { id, ...onlyDeleted },
      include: {
        createdByUser: { select: { id: true, username: true, adminType: true } },
        createdByAgent: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, username: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Deleted service not found" },
        { status: 404 }
      );
    }

    // Tasks were soft deleted with the service, so they are read with
    // `onlyDeleted` too.
    const tasks = await prisma.task.findMany({
      where: { categoryId: id, ...onlyDeleted },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { id: true, name: true } },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
          },
        },
      },
    });

    // The row carries only deletedById/deletedByType, so the deleter's name is
    // resolved separately — it can be either a user or an agent.
    let deletedBy: string | null = null;
    if (category.deletedById) {
      if (category.deletedByType === "AGENT") {
        const agent = await prisma.agent.findFirst({
          where: { id: category.deletedById },
          select: { name: true },
        });
        deletedBy = agent?.name || null;
      } else {
        const user = await prisma.user.findFirst({
          where: { id: category.deletedById },
          select: { username: true },
        });
        deletedBy = user?.username || null;
      }
    }

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        description: category.description || "",
        notes: category.notes || "",
        processFlow: category.processFlow || "",
        color: category.color,
        status: category.status,
        timePeriod: category.timePeriod,
        agentCanEditDays: category.agentCanEditDays,
        createdAt: category.createdAt,
        deletedAt: category.deletedAt,
        deletedByType: category.deletedByType,
        deletedBy,
        createdBy:
          category.createdByUser?.username ||
          category.createdByAgent?.name ||
          "Unknown",
        createdByType: category.createdByUser
          ? "user"
          : category.createdByAgent
          ? "agent"
          : null,
        createdByRole: category.createdByUser?.adminType || null,
        approvedBy: category.approvedBy?.username || null,
        approvedAt: category.approvedAt,
      },
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        deletedAt: task.deletedAt,
        assignedTo: task.assignedTo?.name || null,
        assignedToId: task.assignedTo?.id || null,
        client: task.client
          ? {
              id: task.client.id,
              name:
                task.client.organizationName ||
                `${task.client.firstName || ""} ${
                  task.client.lastName || ""
                }`.trim() ||
                "Unknown Name",
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching deleted service:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted service" },
      { status: 500 }
    );
  }
}
