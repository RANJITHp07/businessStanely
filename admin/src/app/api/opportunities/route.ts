import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

// GET: List all opportunities from Opportunity model
export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const assignedAgentId = req.nextUrl.searchParams.get("assignedAgentId");

    let assignedAgent = null;
    let where: any = {};

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

      if (assignedAgent.agentType === "Lead Maker") {
        where.prospect = { createdByAgentId: agent.id };
      } else if (
        assignedAgent.agentType === "Client Advisor" ||
        assignedAgent.agentType === "Client Manager"
      ) {
        if (assignedAgentId) {
          where.prospect = { assignedAgentId: assignedAgentId };
        }
      }
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
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
