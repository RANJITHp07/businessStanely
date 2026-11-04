import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const FULL_INCLUDE = {
  assignedAgent: true,
  retainership: { include: { client: true } },
  tasks: true,
} satisfies Prisma.LegislationInclude;

// Only what the agent details and client tasks tables render: the tasks are
// just counted.
const LITE_SELECT = {
  id: true,
  title: true,
  description: true,
  assignedAgent: { select: { id: true, name: true } },
  retainership: {
    select: {
      clientId: true,
      client: {
        select: {
          clientType: true,
          firstName: true,
          lastName: true,
          organizationName: true,
          email: true,
        },
      },
    },
  },
  tasks: { select: { active: true, status: true, dueDate: true } },
} satisfies Prisma.LegislationSelect;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedAgent = searchParams.get("assignedAgent");
    const retainershipClientId = searchParams.get("retainershipClientId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));

    // No deletedAt condition here: the soft-delete extension injects one that
    // matches both null and an absent field, and it cascades deletes from a
    // deleted retainership. Spelling out `deletedAt: null` would suppress that
    // injection and hide every row where the field was never written.
    const clientRetainerships = retainershipClientId
      ? await prisma.retainership.findMany({
          where: { clientId: retainershipClientId },
          select: { id: true },
        })
      : null;
    const where = {
      ...(assignedAgent ? { assignedAgentId: assignedAgent } : {}),
      ...(clientRetainerships
        ? { retainershipId: { in: clientRetainerships.map((r) => r.id) } }
        : {}),
    };

    const rowShape: Pick<Prisma.LegislationFindManyArgs, "select" | "include"> =
      searchParams.get("lite") === "true"
        ? { select: LITE_SELECT }
        : { include: FULL_INCLUDE };

    const [legislations, total] = await Promise.all([
      prisma.legislation.findMany({
        where,
        ...rowShape,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.legislation.count({ where }),
    ]);

    return NextResponse.json({
      data: legislations,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching legislations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { title, description, retainershipId, assignedAgentId } = body;

    if (!title || !retainershipId) {
      return new Response("title and retainershipId are required", {
        status: 400,
      });
    }

    const legislation = await prisma.legislation.create({
      data: {
        title,
        description,
        retainership: {
          connect: { id: retainershipId },
        },
        assignedAgent: assignedAgentId
          ? { connect: { id: assignedAgentId } }
          : undefined,
      },
    });

    return new Response(JSON.stringify(legislation), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
