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
 * Tasks are the exception: a retainership delete leaves them untouched, so the
 * per-legislation task count is read through the default (not-deleted) path.
 * Tasks keep their legislationId/retainershipId and reappear under the
 * retainership if it is restored.
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

    // A retainership delete leaves its tasks live, so these are read through the
    // default (not-deleted) path. Only the per-legislation count is shown, so
    // group in the database rather than pulling the rows back.
    const taskGroups = legislationIds.length
      ? await prisma.task.groupBy({
          by: ["legislationId"],
          where: { legislationId: { in: legislationIds } },
          _count: { _all: true },
        })
      : [];

    const taskCountByLegislationId = new Map(
      taskGroups.map((g) => [g.legislationId, g._count._all])
    );

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
