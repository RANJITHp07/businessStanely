import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamType = new URL(req.url).searchParams.get("teamType");

    // Accept agentId as query param, fallback to current agent
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId") || agent.id;

    // Fetch subordinates using AgentSuperior join table (recommended logic)
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: {
        superiorId: agentId,
        subordinate: { status: "active" },
        ...(teamType === "advisor"
          ? { teamType: "advisor" }
          : teamType === "execution"
            ? { teamType: { not: "advisor" } }
            : {}),
      },
      include: {
        subordinate: {
          select: {
            id: true,
            name: true,
            email: true,
            agentType: true,
            phoneNumber: true,
            jurisdiction: true,
            specializations: true,
            photo: true,
            status: true,
            agentRole: true,
            executionAgentType: true,
            advisorAgentType: true,
          },
        },
      },
    });
    const teamMembers = subordinatesLinks.map((link) => link.subordinate);
    return NextResponse.json(teamMembers);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 },
    );
  }
}
