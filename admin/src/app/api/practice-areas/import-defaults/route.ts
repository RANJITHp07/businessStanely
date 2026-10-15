import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_PRACTICE_AREAS } from "@/lib/practiceAreaParameters";

// POST /api/practice-areas/import-defaults
// Adds the website's built-in practice areas that are not in the list yet
// (matched by title, ignoring case), after the existing ones. The website
// shows only database areas once any exist, so this is how the built-in list
// is brought across, whether before or after areas were added by hand.
export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.practiceArea.findMany({
      select: { title: true, sortOrder: true },
    });
    const titles = new Set(existing.map((a) => a.title.toLowerCase()));
    const missing = DEFAULT_PRACTICE_AREAS.filter((area) => !titles.has(area.title.toLowerCase()));
    if (missing.length === 0) {
      return NextResponse.json(
        { error: "All of the website's parameter areas are already in the list" },
        { status: 409 },
      );
    }

    const start = existing.reduce((max, a) => Math.max(max, a.sortOrder), -1) + 1;
    await prisma.practiceArea.createMany({
      data: missing.map((area, index) => ({
        ...area,
        sortOrder: start + index,
        active: true,
        createdById: currentAdmin.id,
      })),
    });

    return NextResponse.json({ imported: missing.length }, { status: 201 });
  } catch (error) {
    console.error("Error importing parameter areas:", error);
    return NextResponse.json({ error: "Failed to import parameter areas" }, { status: 500 });
  }
}
