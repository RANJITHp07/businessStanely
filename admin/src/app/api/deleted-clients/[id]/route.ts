import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { onlyDeleted } from "@/lib/softDelete";

/**
 * GET /api/deleted-clients/[id] — a deleted client plus the work cascaded away
 * with it.
 *
 * Everything is read with `onlyDeleted`, because a client delete stamps the
 * client and its children with the same `deletedAt`. The normal read paths hide
 * all of it, which is exactly why this route exists rather than reusing
 * /api/clients and /api/tasks.
 *
 * Tasks are split the way the live client page splits them: a task carrying a
 * retainershipId belongs to a retainership, the rest are standard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, ...onlyDeleted },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Deleted client not found" },
        { status: 404 },
      );
    }

    const [tasks, retainerships] = await Promise.all([
      prisma.task.findMany({
        where: { clientId: id, ...onlyDeleted },
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          ownerShipBy: { select: { id: true, name: true } },
          retainership: { select: { id: true, name: true } },
        },
      }),
      prisma.retainership.findMany({
        where: { clientId: id, ...onlyDeleted },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Legislations hang off retainershipId, not clientId.
    const retainershipIds = retainerships.map((r) => r.id);
    const legislations = retainershipIds.length
      ? await prisma.legislation.findMany({
          where: { retainershipId: { in: retainershipIds }, ...onlyDeleted },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return NextResponse.json({
      client: {
        ...client,
        name:
          client.organizationName ||
          `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
          "Unknown Name",
      },
      standardTasks: tasks.filter((t) => !t.retainershipId),
      retainershipTasks: tasks.filter((t) => t.retainershipId),
      retainerships,
      legislations,
    });
  } catch (error) {
    console.error("Error fetching deleted client:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted client" },
      { status: 500 },
    );
  }
}
