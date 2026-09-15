import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { onlyDeleted } from "@/lib/softDelete";

/**
 * GET /api/deleted-retainerships — soft-deleted retainerships, newest deletion
 * first.
 *
 * Deleting a retainership cascades the soft delete to its legislations, so the
 * legislation count here is of rows hidden *with* the retainership. It is read
 * with `onlyDeleted` for that reason: the default read path would report zero
 * for every one of them.
 *
 * Tasks are deliberately not cascaded by the delete, so the task count is of
 * live tasks still pointing at the hidden retainership.
 */
export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const retainerships = await prisma.retainership.findMany({
      where: onlyDeleted,
      orderBy: { deletedAt: "desc" },
      include: {
        deletedBy: { select: { id: true, username: true } },
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

    const retainershipIds = retainerships.map((r) => r.id);

    const [legislationGroups, taskGroups] = await Promise.all([
      prisma.legislation.groupBy({
        by: ["retainershipId"],
        where: { retainershipId: { in: retainershipIds }, ...onlyDeleted },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["retainershipId"],
        where: { retainershipId: { in: retainershipIds } },
        _count: { _all: true },
      }),
    ]);

    const legislationCountById = new Map(
      legislationGroups.map((g) => [g.retainershipId, g._count._all])
    );
    const taskCountById = new Map(
      taskGroups.map((g) => [g.retainershipId, g._count._all])
    );

    return NextResponse.json(
      retainerships.map((retainership) => ({
        id: retainership.id,
        name: retainership.name,
        description: retainership.description || "",
        color: retainership.color,
        status: retainership.status,
        createdAt: retainership.createdAt,
        deletedAt: retainership.deletedAt,
        deletedByType: retainership.deletedByType,
        deletedBy: retainership.deletedBy?.username || null,
        client: retainership.client
          ? {
              id: retainership.client.id,
              name:
                retainership.client.organizationName ||
                `${retainership.client.firstName || ""} ${
                  retainership.client.lastName || ""
                }`.trim() ||
                "Unknown Name",
            }
          : null,
        legislationCount: legislationCountById.get(retainership.id) || 0,
        taskCount: taskCountById.get(retainership.id) || 0,
      }))
    );
  } catch (error) {
    console.error("Error fetching deleted retainerships:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted retainerships" },
      { status: 500 }
    );
  }
}
