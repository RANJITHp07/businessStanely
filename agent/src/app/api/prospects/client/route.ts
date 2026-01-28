import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prospects = await prisma.prospect.findMany({
      where: {
        assignedAgentId: agent.id!,
      },
      distinct: ["email", "phoneNumber"],
      include: {
        leadSource: true,
        opportunities: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ prospects });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 },
    );
  }
}
