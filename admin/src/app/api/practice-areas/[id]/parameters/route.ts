import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseDefinitionInput } from "@/lib/practiceAreaParameters";
import { OBJECT_ID_PATTERN, titleTaken, toDefinition } from "@/lib/practiceAreaStore";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/practice-areas/:id/parameters - add a parameter at the end
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: practiceAreaId } = await params;
    if (!OBJECT_ID_PATTERN.test(practiceAreaId)) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const area = await prisma.practiceArea.findUnique({
      where: { id: practiceAreaId },
      select: { id: true },
    });
    if (!area) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const parsed = parseDefinitionInput(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const siblings = await prisma.practiceAreaParameter.findMany({
      where: { practiceAreaId },
      select: { id: true, title: true, sortOrder: true },
    });
    if (titleTaken(siblings, parsed.data.title)) {
      return NextResponse.json(
        { error: `This parameter area already has a parameter called "${parsed.data.title}"` },
        { status: 409 },
      );
    }
    const sortOrder = siblings.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;

    const created = await prisma.practiceAreaParameter.create({
      data: { ...parsed.data, practiceAreaId, sortOrder, createdById: currentAdmin.id },
    });

    return NextResponse.json({ ...toDefinition(created), usageCount: 0 }, { status: 201 });
  } catch (error) {
    console.error("Error creating parameter area parameter:", error);
    return NextResponse.json({ error: "Failed to create parameter" }, { status: 500 });
  }
}
