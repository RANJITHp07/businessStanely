import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { onlyDeleted } from "@/lib/softDelete";

/**
 * GET /api/deleted-retainerships/[id] — a deleted retainership plus the
 * legislation cascaded away with it.
 *
 * The retainership and its legislation are read with `onlyDeleted`, because the
 * delete stamps both with the same `deletedAt` and the normal read paths hide
 * all of it — which is why this route exists rather than reusing
 * /api/retainerships/[id].
 *
 * Tasks cascade too and are returned in full, read with `onlyDeleted` as well.
 * They keep their legislationId/retainershipId and are restored alongside the
 * retainership.
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

    const retainership = await prisma.retainership.findFirst({
      where: { id, ...onlyDeleted },
      include: {
        deletedBy: { select: { id: true, username: true } },
        createdByUser: { select: { id: true, username: true } },
        createdByAgent: { select: { id: true, name: true } },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            email: true,
          },
        },
      },
    });

    if (!retainership) {
      return NextResponse.json(
        { error: "Deleted retainership not found" },
        { status: 404 }
      );
    }

    const legislations = await prisma.legislation.findMany({
      where: { retainershipId: id, ...onlyDeleted },
      orderBy: { createdAt: "desc" },
      include: {
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    const legislationIds = legislations.map((l) => l.id);

    // Tasks were soft deleted with the retainership, so they are read with
    // `onlyDeleted`. They hang off the retainership directly or off one of its
    // legislations, so both paths are matched.
    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          {
            OR: [
              { retainershipId: id },
              ...(legislationIds.length
                ? [{ legislationId: { in: legislationIds } }]
                : []),
            ],
          },
          onlyDeleted,
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { id: true, name: true } },
        legislation: { select: { id: true, title: true } },
      },
    });

    // The legislation table shows a per-legislation count, derived from the
    // same rows rather than a second query.
    const taskCountByLegislationId = new Map<string, number>();
    for (const task of tasks) {
      if (!task.legislationId) continue;
      taskCountByLegislationId.set(
        task.legislationId,
        (taskCountByLegislationId.get(task.legislationId) || 0) + 1
      );
    }

    return NextResponse.json({
      retainership: {
        id: retainership.id,
        name: retainership.name,
        description: retainership.description || "",
        color: retainership.color,
        status: retainership.status,
        createdAt: retainership.createdAt,
        deletedAt: retainership.deletedAt,
        deletedByType: retainership.deletedByType,
        deletedBy: retainership.deletedBy?.username || null,
        createdBy:
          retainership.createdByUser?.username ||
          retainership.createdByAgent?.name ||
          "Unknown",
        createdByType: retainership.createdByUser
          ? "user"
          : retainership.createdByAgent
          ? "agent"
          : null,
        client: retainership.client
          ? {
              id: retainership.client.id,
              name:
                retainership.client.organizationName ||
                `${retainership.client.firstName || ""} ${
                  retainership.client.lastName || ""
                }`.trim() ||
                "Unknown Name",
              email: retainership.client.email,
            }
          : null,
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
        legislationId: task.legislation?.id || null,
        legislationTitle: task.legislation?.title || null,
      })),
      legislations: legislations.map((legislation) => ({
        id: legislation.id,
        title: legislation.title,
        description: legislation.description || "",
        assignedAgent: legislation.assignedAgent?.name || null,
        assignedAgentId: legislation.assignedAgent?.id || null,
        createdAt: legislation.createdAt,
        deletedAt: legislation.deletedAt,
        taskCount: taskCountByLegislationId.get(legislation.id) || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching deleted retainership:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted retainership" },
      { status: 500 }
    );
  }
}
