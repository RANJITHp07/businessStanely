import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaRaw } from "@/lib/prisma";
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
    // Stats mode: the Opportunity Reports dashboard renders only aggregates
    // (status counts, lead-source distribution, follow-up/missed split). Fetch a
    // narrow projection instead of every opportunity with all of its comments.
    if (req.nextUrl.searchParams.get("stats") === "true") {
      const rows = await prisma.opportunity.findMany({
        select: {
          status: true,
          nextFollowUp: true,
          prospect: {
            select: {
              leadSourceId: true,
              assignedAgentId: true,
              createdByAgentId: true,
            },
          },
          comments: {
            select: { createdAt: true, authorId: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      const advisorType = assignedAgent
        ? getAssignedAdvisorType(assignedAgent)
        : null;

      const scoped = rows.filter((row) => {
        if (!assignedAgentId || !assignedAgent) return true;
        if (advisorType === "Lead Maker") {
          return row.prospect?.createdByAgentId === assignedAgentId;
        }
        if (
          advisorType === "Client Advisor" ||
          advisorType === "Client Manager"
        ) {
          return row.prospect?.assignedAgentId === assignedAgentId;
        }
        return true;
      });

      const statusCounts: Record<string, number> = {};
      const leadSourceCounts: Record<string, number> = {};
      const engagement = { followUp: 0, missed: 0 };

      for (const row of scoped) {
        if (row.status)
          statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;

        const leadSourceId = row.prospect?.leadSourceId;
        if (leadSourceId)
          leadSourceCounts[leadSourceId] =
            (leadSourceCounts[leadSourceId] ?? 0) + 1;

        // Follow-up vs missed: only opportunities with a scheduled follow-up
        // count, matching the dashboard's original tally.
        if (!row.nextFollowUp) continue;
        const lastAgentComment = row.comments.find(
          (c) => c.authorId === row.prospect?.assignedAgentId,
        );
        if (!lastAgentComment || row.nextFollowUp > lastAgentComment.createdAt) {
          engagement.followUp++;
        } else {
          engagement.missed++;
        }
      }

      return NextResponse.json({
        total: scoped.length,
        statusCounts,
        leadSourceCounts,
        engagement,
      });
    }

    // An advisor's opportunities are found through their prospects' ids, so only
    // those rows are read. The raw client keeps opportunities whose prospect was
    // soft deleted, which this list has always shown.
    let scope: { prospectId: { in: string[] } } | undefined;
    if (assignedAgentId && assignedAgent) {
      const prospects = await prismaRaw.prospect.findMany({
        where:
          getAssignedAdvisorType(assignedAgent) === "Lead Maker"
            ? { createdByAgentId: assignedAgentId }
            : { assignedAgentId },
        select: { id: true },
      });
      scope = { prospectId: { in: prospects.map((prospect) => prospect.id) } };
    }

    // Table view: only what the opportunity tables render.
    if (req.nextUrl.searchParams.get("view") === "table") {
      const opportunities = await prisma.opportunity.findMany({
        where: scope,
        include: {
          prospect: {
            select: {
              assignedAgentId: true,
              assignedAgent: { select: { id: true, name: true } },
              createdByAgent: { select: { id: true, name: true } },
              leadSource: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ opportunities });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: scope,
      include: {
        prospect: { include: { assignedAgent: true, createdByAgent: true, leadSource: true } },
        comments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
