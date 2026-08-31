import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Follow-up state only needs the assigned agent's newest comment, but comments
 * from other authors can sit on top of it. Scanning a small newest-first window
 * finds it in practice without loading the whole thread.
 */
const NEWEST_COMMENTS_SCANNED = 20;

/**
 * The list endpoint feeds tables that show a prospect's own columns plus the
 * assigned/creator agent name, and derive a follow-up state from the assigned
 * agent's most recent comment. Selecting explicitly keeps agent credential
 * fields (password, resetOtp) off the wire and stops whole comment threads,
 * attachments included, from being shipped per row.
 */
const PROSPECT_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  service: true,
  phone: true,
  phoneNumber: true,
  description: true,
  amount: true,
  address: true,
  status: true,
  notes: true,
  nextFollowUp: true,
  archived: true,
  leadSourceId: true,
  createdAt: true,
  updatedAt: true,
  assignedAgentId: true,
  createdByAgentId: true,
  assignedAgent: { select: { id: true, name: true } },
  createdByAgent: { select: { id: true, name: true } },
  comments: {
    select: { id: true, createdAt: true, authorId: true },
    orderBy: { createdAt: "desc" as const },
    take: NEWEST_COMMENTS_SCANNED,
  },
} satisfies Prisma.ProspectSelect;

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

/**
 * Follow-up / missed / to-be-contacted split for the Lead Reports dashboard.
 *
 * A prospect with no `nextFollowUp` is "To Be Contacted". Otherwise it is
 * "Follow Up" while the scheduled date is still ahead of the assigned agent's
 * most recent comment, and "Missed" once that comment overtakes it.
 *
 * This mirrors the tally the page used to run in the browser, but pulls only
 * each prospect's newest comment instead of the whole comment thread.
 */
async function buildEngagementCounts(where: Prisma.ProspectWhereInput) {
  const prospects = await prisma.prospect.findMany({
    where,
    select: {
      nextFollowUp: true,
      assignedAgentId: true,
      comments: {
        select: { createdAt: true, authorId: true },
        orderBy: { createdAt: "desc" },
        take: NEWEST_COMMENTS_SCANNED,
      },
    },
  });

  const counts = { followUp: 0, missed: 0, toBeContacted: 0 };

  for (const p of prospects) {
    if (!p.nextFollowUp) {
      counts.toBeContacted++;
      continue;
    }

    const lastAgentComment = p.comments.find(
      (c) => c.authorId === p.assignedAgentId,
    );

    if (!lastAgentComment) {
      counts.followUp++;
    } else if (p.nextFollowUp > lastAgentComment.createdAt) {
      counts.followUp++;
    } else {
      counts.missed++;
    }
  }

  return counts;
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where: Prisma.ProspectWhereInput = {
      archived: false,
      status: { not: "opportunity" },
      deletedAt: null,
    };

    const { searchParams } = new URL(req.url);
    const assignedAgentId = searchParams.get("assignedAgentId");

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

      if (advisorType === "Lead Maker") {
        where.createdByAgentId = assignedAgentId;
      } else if (
        advisorType === "Client Advisor" ||
        advisorType === "Client Manager"
      ) {
        if (assignedAgentId) {
          where.assignedAgentId = assignedAgentId;
        }
      }
    }

    // Stats mode: the Lead Reports dashboard renders only aggregates (status
    // counts, lead-source distribution, follow-up/missed split). Compute those
    // here instead of shipping every prospect and all of its comments.
    if (searchParams.get("stats") === "true") {
      const [statusGroups, leadSourceGroups, engagement] = await Promise.all([
        prisma.prospect.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
        prisma.prospect.groupBy({
          by: ["leadSourceId"],
          where,
          _count: { _all: true },
        }),
        buildEngagementCounts(where),
      ]);

      const statusCounts: Record<string, number> = {};
      let total = 0;
      for (const g of statusGroups) {
        const n = g._count._all;
        total += n;
        if (g.status) statusCounts[g.status] = n;
      }

      return NextResponse.json({
        total,
        statusCounts,
        leadSourceCounts: Object.fromEntries(
          leadSourceGroups
            .filter((g) => g.leadSourceId)
            .map((g) => [g.leadSourceId as string, g._count._all]),
        ),
        engagement,
      });
    }

    const prospects = await prisma.prospect.findMany({
      where,
      select: PROSPECT_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ prospects });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 },
    );
  }
}

// POST: Create a new prospect
export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const {
      name,
      email,
      phone,
      phoneNumber,
      description,
      status,
      notes,
      nextFollowUp,
      assignedAgentId,
      leadSourceId,
      amount,
      address,
      service,
    } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!assignedAgentId) {
      return NextResponse.json(
        { error: "Assigned agent is required" },
        { status: 400 },
      );
    }
    let finalAssignedAgentId = assignedAgentId;

    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        phone,
        phoneNumber,
        description,
        address,
        leadSourceId,
        status: status || "New",
        notes,
        service: service || "",
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgentId: finalAssignedAgentId,
        createdByAgentId: agent.id,
        amount: typeof amount === "number" ? amount : undefined,
      },
      include: { createdByAgent: true, assignedAgent: true },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 },
    );
  }
}
