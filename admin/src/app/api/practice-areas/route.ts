import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseParameterList, parsePracticeAreaInput } from "@/lib/practiceAreaParameters";
import { countAreaUsage, titleTaken } from "@/lib/practiceAreaStore";

// GET /api/practice-areas - every practice area, in website order, with
// parameter counts for the list page.
export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const areas = await prisma.practiceArea.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        parameters: { select: { required: true } },
      },
    });

    const result = await Promise.all(
      areas.map(async ({ parameters, ...area }) => ({
        ...area,
        createdAt: area.createdAt.toISOString(),
        updatedAt: area.updatedAt.toISOString(),
        parameterCount: parameters.length,
        requiredCount: parameters.filter((p) => p.required).length,
        enquiryCount: await countAreaUsage(area.id),
      })),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching parameter areas:", error);
    return NextResponse.json({ error: "Failed to fetch parameter areas" }, { status: 500 });
  }
}

// POST /api/practice-areas - add a practice area at the end of the list,
// with its parameters (optional `parameters` array, in form order)
export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parsePracticeAreaInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const parameters = parseParameterList(body.parameters ?? []);
    if (!parameters.ok) {
      return NextResponse.json({ error: parameters.error }, { status: 400 });
    }

    const existing = await prisma.practiceArea.findMany({
      select: { id: true, title: true, sortOrder: true },
    });
    if (titleTaken(existing, parsed.data.title)) {
      return NextResponse.json(
        { error: `A parameter area called "${parsed.data.title}" already exists` },
        { status: 409 },
      );
    }
    const sortOrder = existing.reduce((max, a) => Math.max(max, a.sortOrder), -1) + 1;

    // One nested write, so the area and its parameters land together or not
    // at all.
    const created = await prisma.practiceArea.create({
      data: {
        ...parsed.data,
        sortOrder,
        createdById: currentAdmin.id,
        parameters: {
          create: parameters.data.map(({ id: _ignored, ...definition }, index) => ({
            ...definition,
            sortOrder: index,
            createdById: currentAdmin.id,
          })),
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating parameter area:", error);
    return NextResponse.json({ error: "Failed to create parameter area" }, { status: 500 });
  }
}
