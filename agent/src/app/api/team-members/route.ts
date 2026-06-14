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

    const teamFilter =
      teamType === "advisor"
        ? { teamType: "advisor" }
        : teamType === "execution"
          ? { teamType: { not: "advisor" } }
          : {};

    const visited = new Set<string>([agentId]);
    const teamMembers = [];
    let frontier = [agentId];

    while (frontier.length > 0) {
      const links = await prisma.agentSuperior.findMany({
        where: {
          superiorId: { in: frontier },
          subordinate: { status: "active" },
          ...teamFilter,
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

      const nextFrontier: string[] = [];
      for (const link of links) {
        if (visited.has(link.subordinate.id)) continue;
        visited.add(link.subordinate.id);
        teamMembers.push(link.subordinate);
        nextFrontier.push(link.subordinate.id);
      }
      frontier = nextFrontier;
    }

    return NextResponse.json(teamMembers);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 },
    );
  }
}
