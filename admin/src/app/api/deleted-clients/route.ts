import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { onlyDeleted } from "@/lib/softDelete";

/**
 * GET /api/deleted-clients — soft-deleted clients, newest deletion first.
 *
 * Deleting a client cascades the soft delete to its tasks and retainerships, so
 * the counts here are of rows hidden *with* the client rather than rows still
 * live. They are read with the same `onlyDeleted` filter for that reason: the
 * default read path would report zero for every one of them.
 */
export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: onlyDeleted,
      orderBy: { deletedAt: "desc" },
    });

    const clientIds = clients.map((c) => c.id);

    const [taskGroups, retainershipGroups] = await Promise.all([
      prisma.task.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clientIds }, ...onlyDeleted },
        _count: { _all: true },
      }),
      prisma.retainership.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clientIds }, ...onlyDeleted },
        _count: { _all: true },
      }),
    ]);

    const taskCountByClientId = new Map(
      taskGroups.map((g) => [g.clientId, g._count._all]),
    );
    const retainershipCountByClientId = new Map(
      retainershipGroups.map((g) => [g.clientId, g._count._all]),
    );

    return NextResponse.json(
      clients.map((client) => ({
        ...client,
        name:
          client.organizationName ||
          `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
          "Unknown Name",
        taskCount: taskCountByClientId.get(client.id) || 0,
        retainershipCount: retainershipCountByClientId.get(client.id) || 0,
      })),
    );
  } catch (error) {
    console.error("Error fetching deleted clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted clients" },
      { status: 500 },
    );
  }
}
