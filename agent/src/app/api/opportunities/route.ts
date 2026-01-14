import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

// GET: List all opportunities from Opportunity model
export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // MongoDB does not support relation filtering in Prisma, so filter in-memory
    const allOpportunities = await prisma.opportunity.findMany({
      include: { prospect: true, comments: true },
      orderBy: { createdAt: "desc" },
    });
    let opportunities = allOpportunities;
    if (agent.agentType === "Lead Maker") {
      opportunities = allOpportunities.filter(
        (o) => o.prospect?.createdByAgentId === agent.id
      );
    } else if (
      agent.agentType === "Client Advisor" ||
      agent.agentType === "Client Manager"
    ) {
      opportunities = allOpportunities.filter(
        (o) => o.prospect?.assignedAgentId === agent.id
      );
    }
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}
