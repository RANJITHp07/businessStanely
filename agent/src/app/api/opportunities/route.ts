import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { getAdvisorAgentType } from "@/lib/agentType";

function getAssignedAdvisorType(assignedAgent: {
  agentType?: string | null;
  advisorAgentType?: string | null;
  agentRole?: string | null;
}) {
  if (assignedAgent.agentRole === "Execution & Advisor Agent") {
    return assignedAgent.advisorAgentType || assignedAgent.agentType || null;
  }

  return assignedAgent.agentType || assignedAgent.advisorAgentType || null;
}

// GET: List all opportunities from Opportunity model
export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requestedAgentId = req.nextUrl.searchParams.get("assignedAgentId");

    let targetAgent = agent;

    if (requestedAgentId && requestedAgentId !== agent.id) {
      const superiorLink = await prisma.agentSuperior.findFirst({
        where: {
          superiorId: agent.id,
          subordinateId: requestedAgentId,
        },
      });

      if (!superiorLink) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const requestedAgent = await prisma.agent.findUnique({
        where: { id: requestedAgentId },
      });

      if (!requestedAgent) {
        return NextResponse.json(
          { error: "Assigned agent not found" },
          { status: 404 },
        );
      }

      targetAgent = requestedAgent;
    }

    // MongoDB does not support relation filtering in Prisma, so filter in-memory
    const allOpportunities = await prisma.opportunity.findMany({
      include: {
        prospect: { include: { assignedAgent: true } },
        comments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    let opportunities = allOpportunities;
    const advisorType = requestedAgentId
      ? getAssignedAdvisorType(targetAgent)
      : getAdvisorAgentType(agent);

    if (advisorType === "Lead Maker") {
      opportunities = allOpportunities.filter(
        (o) => o.prospect?.createdByAgentId === targetAgent.id,
      );
    } else if (
      advisorType === "Client Advisor" ||
      advisorType === "Client Manager"
    ) {
      opportunities = allOpportunities.filter(
        (o) => o.prospect?.assignedAgentId === targetAgent.id,
      );
    }
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
