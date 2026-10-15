import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { actorFromAdmin } from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import prisma from "@/lib/prisma";
import { OBJECT_ID_PATTERN } from "@/lib/practiceAreaStore";

// POST /api/practice-areas/reorder
// Body: { orderedIds } -- every practice area, in the order the website should
// show them.
export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderedIds } = (await req.json()) as { orderedIds?: unknown };
    if (
      !Array.isArray(orderedIds) ||
      !orderedIds.every((id) => typeof id === "string" && OBJECT_ID_PATTERN.test(id))
    ) {
      return NextResponse.json({ error: "Invalid reorder request" }, { status: 400 });
    }

    const current = await prisma.practiceArea.findMany({ select: { id: true } });
    const currentIds = new Set(current.map((a) => a.id));
    const requested = new Set(orderedIds as string[]);

    // Must be exactly the current list, so a stale page cannot drop an area
    // someone else just added out of the order.
    if (
      requested.size !== orderedIds.length ||
      requested.size !== currentIds.size ||
      [...requested].some((id) => !currentIds.has(id))
    ) {
      return NextResponse.json(
        { error: "The parameter area list has changed. Refresh and try again." },
        { status: 409 },
      );
    }

    const actor = actorFromAdmin(currentAdmin);
    await withActor(actor, () =>
      prisma.$transaction(
        (orderedIds as string[]).map((id, index) =>
          prisma.practiceArea.update({ where: { id }, data: { sortOrder: index } }),
        ),
      ),
    );

    return NextResponse.json({ message: "Order saved" });
  } catch (error) {
    console.error("Error reordering parameter areas:", error);
    return NextResponse.json({ error: "Failed to reorder parameter areas" }, { status: 500 });
  }
}
