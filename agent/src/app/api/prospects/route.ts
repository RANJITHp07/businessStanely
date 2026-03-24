import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdvisorAgentType } from "@/lib/agentType";
import { getCurrentAgent } from "@/lib/auth";

// GET: List all prospects (optionally filter by assignedAgentId)
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

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const where: Record<string, unknown> = {
      archived: false,
      status: { not: "opportunity" },
    };
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

    if (advisorType === "Lead Maker") {
      where.createdByAgentId = targetAgent.id;
    } else if (
      advisorType === "Client Advisor" ||
      advisorType === "Client Manager"
    ) {
      where.assignedAgentId = targetAgent.id;
    }

    const prospects = await prisma.prospect.findMany({
      where,
      include: { assignedAgent: true, createdByAgent: true, comments: true },
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

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const advisorType = getAdvisorAgentType(agent);

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
      dialCode,
      service,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (
      (advisorType === "Client Advisor" || advisorType === "Client Manager") &&
      !assignedAgentId
    ) {
      return NextResponse.json(
        { error: "Assigned agent is required for this role." },
        { status: 400 },
      );
    }

    let finalAssignedAgentId = assignedAgentId;

    if (!assignedAgentId) {
      const assignmentSetting =
        await prisma.prospectAssignmentSetting.findFirst();
      const prospectsPerAgent = assignmentSetting?.prospectsPerAgent ?? 1;

      // 1️⃣ Fetch clientAdvisorIds linked to this Lead Maker
      const leadMaker = await prisma.agent.findUnique({
        where: { id: agent.id },
        select: { clientAdvisorIds: true },
      });

      let eligibleAgents;

      if (leadMaker?.clientAdvisorIds?.length) {
        // 2️⃣ Use mapped advisors
        eligibleAgents = await prisma.agent.findMany({
          where: {
            id: { in: leadMaker.clientAdvisorIds },
            status: "active",
            autoAssign: true,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
      }

      // 3️⃣ Fallback: pick from all active client advisors
      if (!eligibleAgents?.length) {
        eligibleAgents = await prisma.agent.findMany({
          where: {
            agentType: "Client Advisor",
            status: "active",
            autoAssign: true,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
      }

      if (!eligibleAgents.length) {
        return NextResponse.json(
          { error: "No eligible client advisors available for assignment." },
          { status: 400 },
        );
      }

      // 4️⃣ Round-robin assignment
      const lastProspect = await prisma.prospect.findFirst({
        where: { assignedAgentId: { in: eligibleAgents.map((a) => a.id) } },
        orderBy: { createdAt: "desc" },
        select: { assignedAgentId: true },
      });

      if (!lastProspect) {
        finalAssignedAgentId = eligibleAgents[0].id;
      } else {
        const lastBatch = await prisma.prospect.findMany({
          where: { assignedAgentId: { in: eligibleAgents.map((a) => a.id) } },
          orderBy: { createdAt: "desc" },
          take: prospectsPerAgent,
          select: { assignedAgentId: true },
        });

        let consecutiveCount = 0;
        for (const p of lastBatch) {
          if (p.assignedAgentId === lastProspect.assignedAgentId)
            consecutiveCount++;
          else break;
        }

        if (consecutiveCount < prospectsPerAgent) {
          finalAssignedAgentId = lastProspect.assignedAgentId;
        } else {
          const lastIndex = eligibleAgents.findIndex(
            (a) => a.id === lastProspect.assignedAgentId,
          );
          const nextIndex = (lastIndex + 1) % eligibleAgents.length;
          finalAssignedAgentId = eligibleAgents[nextIndex].id;
        }
      }
    }

    // 5️⃣ Create the prospect
    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        dialCode,
        phoneNumber,
        description,
        address,
        ...(leadSourceId && { leadSource: { connect: { id: leadSourceId } } }),
        status: status || "New",
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgent: { connect: { id: finalAssignedAgentId } },
        createdByAgent: { connect: { id: agent.id } },
        amount: typeof amount === "number" ? amount : undefined,
        ...(service && { service }),
      },
      include: { createdByAgent: true, assignedAgent: true },
    });

    return NextResponse.json({ prospect });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 },
    );
  }
}
