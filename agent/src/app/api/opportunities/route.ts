import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { getAdvisorAgentType } from "@/lib/agentType";
import {
  OPPORTUNITY_SUMMARY_STATUSES,
  OPPORTUNITY_SUMMARY_INCLUDE,
  buildOpportunityCounts,
} from "@/lib/opportunitySummary";

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

    const advisorType = requestedAgentId
      ? getAssignedAdvisorType(targetAgent)
      : getAdvisorAgentType(agent);

    // Mongo can't filter Opportunity by a Prospect relation field, so resolve
    // the agent's prospect ids first and scope by `prospectId` instead.
    const scopedProspectIds = async (
      field: "createdByAgentId" | "assignedAgentId",
    ) => {
      const prospects = await prisma.prospect.findMany({
        where: { [field]: targetAgent.id },
        select: { id: true },
      });
      return prospects.map((p) => p.id);
    };

    // Summary mode: the My Opportunities dashboard renders only the newest few
    // rows per status plus the headline counts/amounts, so fetch exactly that
    // instead of every opportunity. `limit` is the per-status row cap.
    if (req.nextUrl.searchParams.get("summary") === "true") {
      const limit = Math.min(
        Math.max(
          parseInt(req.nextUrl.searchParams.get("limit") || "5", 10) || 5,
          1,
        ),
        50,
      );

      // Scope by agent in the database rather than in memory. The full listing
      // below still filters in-memory for backwards compatibility.
      const where: Prisma.OpportunityWhereInput = {};
      if (advisorType === "Lead Maker") {
        where.prospectId = { in: await scopedProspectIds("createdByAgentId") };
      } else if (
        advisorType === "Client Advisor" ||
        advisorType === "Client Manager"
      ) {
        where.prospectId = { in: await scopedProspectIds("assignedAgentId") };
      }

      const [groups, sections] = await Promise.all([
        prisma.opportunity.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
          _sum: { amount: true },
        }),
        Promise.all(
          OPPORTUNITY_SUMMARY_STATUSES.map(async (status) => ({
            status,
            opportunities: await prisma.opportunity.findMany({
              where: { ...where, status },
              include: OPPORTUNITY_SUMMARY_INCLUDE,
              orderBy: { createdAt: "desc" },
              take: limit,
            }),
          })),
        ),
      ]);

      return NextResponse.json({
        counts: buildOpportunityCounts(groups),
        sections: Object.fromEntries(
          sections.map((s) => [s.status, s.opportunities]),
        ),
      });
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
