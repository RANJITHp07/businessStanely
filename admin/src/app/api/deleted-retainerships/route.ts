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
 * Tasks cascade the same way, and hang off either the retainership directly or
 * one of its legislations, so both paths are counted — also with `onlyDeleted`.
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

    const [legislations, directTaskGroups] = await Promise.all([
      prisma.legislation.findMany({
        where: { retainershipId: { in: retainershipIds }, ...onlyDeleted },
        select: { id: true, retainershipId: true },
      }),
      prisma.task.groupBy({
        by: ["retainershipId"],
        where: { retainershipId: { in: retainershipIds }, ...onlyDeleted },
        _count: { _all: true },
      }),
    ]);

    const legislationCountById = new Map<string, number>();
    const retainershipIdByLegislationId = new Map<string, string>();
    for (const legislation of legislations) {
      legislationCountById.set(
        legislation.retainershipId,
        (legislationCountById.get(legislation.retainershipId) || 0) + 1
      );
      retainershipIdByLegislationId.set(
        legislation.id,
        legislation.retainershipId
      );
    }

    const taskCountById = new Map<string, number>();
    for (const group of directTaskGroups) {
      if (!group.retainershipId) continue;
      taskCountById.set(group.retainershipId, group._count._all);
    }

    // Tasks linked only through a legislation carry no retainershipId, so they
    // are counted separately and folded into the same totals.
    const legislationIds = [...retainershipIdByLegislationId.keys()];
    if (legislationIds.length) {
      const viaLegislation = await prisma.task.groupBy({
        by: ["legislationId"],
        where: {
          AND: [
            { legislationId: { in: legislationIds } },
            // Exclude tasks already counted above. On MongoDB `null` does not
            // match an absent field, so both spellings are matched.
            {
              OR: [
                { retainershipId: null },
                { retainershipId: { isSet: false } },
              ],
            },
            onlyDeleted,
          ],
        },
        _count: { _all: true },
      });

      for (const group of viaLegislation) {
        if (!group.legislationId) continue;
        const retainershipId = retainershipIdByLegislationId.get(
          group.legislationId
        );
        if (!retainershipId) continue;
        taskCountById.set(
          retainershipId,
          (taskCountById.get(retainershipId) || 0) + group._count._all
        );
      }
    }

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
