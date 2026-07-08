import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedAgent = searchParams.get("assignedAgent");
    const retainershipClientId = searchParams.get("retainershipClientId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));

    const where = {
      ...(assignedAgent ? { assignedAgentId: assignedAgent } : {}),
      ...(retainershipClientId
        ? { retainership: { clientId: retainershipClientId } }
        : {}),
    };

    const [legislations, total] = await Promise.all([
      prisma.legislation.findMany({
        where,
        include: {
          assignedAgent: true,
          retainership: {
            include: {
              client: true,
            },
          },
          tasks: true,
        },
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
