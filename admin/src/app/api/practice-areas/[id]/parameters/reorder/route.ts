import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { actorFromAdmin } from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import prisma from "@/lib/prisma";
import { OBJECT_ID_PATTERN } from "@/lib/practiceAreaStore";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/practice-areas/:id/parameters/reorder
// Body: { orderedIds } -- every parameter of the area, in form order.
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: practiceAreaId } = await params;
    const { orderedIds } = (await req.json()) as { orderedIds?: unknown };
    if (
      !OBJECT_ID_PATTERN.test(practiceAreaId) ||
      !Array.isArray(orderedIds) ||
      !orderedIds.every((id) => typeof id === "string" && OBJECT_ID_PATTERN.test(id))
    ) {
      return NextResponse.json({ error: "Invalid reorder request" }, { status: 400 });
    }

    const current = await prisma.practiceAreaParameter.findMany({
      where: { practiceAreaId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((p) => p.id));
    const requested = new Set(orderedIds as string[]);

    if (
      requested.size !== orderedIds.length ||
      requested.size !== currentIds.size ||
      [...requested].some((id) => !currentIds.has(id))
    ) {
      return NextResponse.json(
        { error: "The parameter list has changed. Refresh and try again." },
        { status: 409 },
      );
    }

    const actor = actorFromAdmin(currentAdmin);
    await withActor(actor, () =>
      prisma.$transaction(
        (orderedIds as string[]).map((id, index) =>
          prisma.practiceAreaParameter.update({ where: { id }, data: { sortOrder: index } }),
        ),
      ),
    );

    return NextResponse.json({ message: "Order saved" });
  } catch (error) {
    console.error("Error reordering parameters:", error);
    return NextResponse.json({ error: "Failed to reorder parameters" }, { status: 500 });
  }
}
