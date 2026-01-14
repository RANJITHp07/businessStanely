import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedAgent = searchParams.get("assignedAgent");

    const agent = await getCurrentAgent(req);

    let whereClause: any = {};

    if (assignedAgent === "me") {
      if (!agent?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      whereClause.assignedAgentId = agent.id;
    }

    const legislations = await prisma.legislation.findMany({
      where: whereClause,
      include: {
        assignedAgent: true,
        retainership: {
          include: {
            client: true,
          },
        },
        tasks: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(legislations);
  } catch (error) {
    console.error("Error fetching legislations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
