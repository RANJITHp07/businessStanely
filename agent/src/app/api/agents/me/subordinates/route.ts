import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { hasAdvisorRole } from "@/lib/agentRole";
import { getAdvisorAgentType } from "@/lib/agentType";

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamType = req.nextUrl.searchParams.get("teamType");

  // Only allow for Client Manager
  if (
    !hasAdvisorRole(agent.agentRole) ||
    getAdvisorAgentType(agent) !== "Client Manager"
  ) {
    return NextResponse.json([]);
  }
  // Find subordinates (Client Advisors)
  const links = await prisma.agentSuperior.findMany({
    where: {
      superiorId: agent.id,
      ...(teamType === "advisor"
        ? { teamType: "advisor" }
        : teamType === "execution"
          ? { teamType: { not: "advisor" } }
          : {}),
      subordinate: {
        status: "active",
      },
    },
    include: { subordinate: true },
  });
  const subordinates = links.map((l) => l.subordinate);
  return NextResponse.json(subordinates);
}
