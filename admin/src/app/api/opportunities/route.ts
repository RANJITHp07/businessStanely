import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

function getAssignedAdvisorType(assignedAgent: {
  id: string;
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
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const assignedAgentId = req.nextUrl.searchParams.get("assignedAgentId");

    let assignedAgent = null;

    if (assignedAgentId) {
      assignedAgent = await prisma.agent.findUnique({
        where: { id: assignedAgentId },
      });

      if (!assignedAgent) {
        return NextResponse.json(
          { error: "Assigned agent not found" },
          { status: 404 },
        );
      }

      const advisorType = getAssignedAdvisorType(assignedAgent);

      if (
        advisorType !== "Client Advisor" &&
        advisorType !== "Client Manager" &&
        advisorType !== "Lead Maker"
      ) {
        assignedAgent = null;
      }
    }
    // MongoDB does not support relation filtering in Prisma, so filter in-memory
    const allOpportunities = await prisma.opportunity.findMany({
      include: {
        prospect: { include: { assignedAgent: true, createdByAgent: true } },
        comments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    let opportunities = allOpportunities;

    if (assignedAgentId && assignedAgent) {
      const advisorType = getAssignedAdvisorType(assignedAgent);

      opportunities = allOpportunities.filter((opportunity) => {
        if (advisorType === "Lead Maker") {
          return opportunity.prospect?.createdByAgentId === assignedAgentId;
        }

        if (
          advisorType === "Client Advisor" ||
          advisorType === "Client Manager"
        ) {
          return opportunity.prospect?.assignedAgentId === assignedAgentId;
        }

        return true;
      });
    }

    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
