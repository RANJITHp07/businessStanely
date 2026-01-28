import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
// import { getCurrentAgent } from "@/lib/auth";

// GET: List all prospects (optionally filter by assignedAgentId)
import { getCurrentAgent } from "@/lib/auth";

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
    if (agent.agentType === "Lead Maker") {
      where.createdByAgentId = agent.id;
    } else if (
      agent.agentType === "Client Advisor" ||
      agent.agentType === "Client Manager"
    ) {
      where.assignedAgentId = agent.id;
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
    // 1️⃣ Get current agent
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️⃣ Parse request body
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
      dialCode,
      serviceId,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // 3️⃣ Validate role-based assignment
    if (
      (agent.agentType === "Client Advisor" ||
        agent.agentType === "Client Manager") &&
      !assignedAgentId
    ) {
      return NextResponse.json(
        { error: "Assigned agent is required for this role." },
        { status: 400 },
      );
    }

    let finalAssignedAgentId = assignedAgentId;

    // 4️⃣ Auto-assign using batch round-robin
    if (!assignedAgentId) {
      // Fetch assignment setting
      const assignmentSetting =
        await prisma.prospectAssignmentSetting.findFirst();
      const prospectsPerAgent = assignmentSetting?.prospectsPerAgent ?? 1;

      // Eligible agents
      const eligibleAgents = await prisma.agent.findMany({
        where: {
          agentType: { in: ["Client Manager", "Client Advisor"] },
          status: "active",
          autoAssign: true,
          id: { not: agent.id },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (eligibleAgents.length > 0) {
        // Get last prospect assigned to eligible agents
        const lastProspect = await prisma.prospect.findFirst({
          where: {
            assignedAgentId: { in: eligibleAgents.map((a) => a.id) },
          },
          orderBy: { createdAt: "desc" },
          select: { assignedAgentId: true },
        });

        if (!lastProspect) {
          // No previous prospects → assign first agent
          finalAssignedAgentId = eligibleAgents[0].id;
        } else {
          // Get last batch of assignments to check sequence
          const lastBatch = await prisma.prospect.findMany({
            where: {
              assignedAgentId: { in: eligibleAgents.map((a) => a.id) },
            },
            orderBy: { createdAt: "desc" },
            take: prospectsPerAgent,
            select: { assignedAgentId: true },
          });

          // Count consecutive assignments of last agent
          let consecutiveCount = 0;
          for (const p of lastBatch) {
            if (p.assignedAgentId === lastProspect.assignedAgentId)
              consecutiveCount++;
            else break; // stop when sequence breaks
          }

          if (consecutiveCount < prospectsPerAgent) {
            // Keep same agent
            finalAssignedAgentId = lastProspect.assignedAgentId;
          } else {
            // Move to next agent
            const lastIndex = eligibleAgents.findIndex(
              (a) => a.id === lastProspect.assignedAgentId,
            );
            const nextIndex = (lastIndex + 1) % eligibleAgents.length;
            finalAssignedAgentId = eligibleAgents[nextIndex].id;
          }
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
        ...(leadSourceId && {
          leadSource: {
            connect: {
              id: leadSourceId,
            },
          },
        }),
        status: status || "New",
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgent: {
          connect: { id: assignedAgentId },
        },
        createdByAgent: {
          connect: { id: agent.id },
        },
        amount: typeof amount === "number" ? amount : undefined,
        ...(serviceId && {
          service: {
            connect: { id: serviceId },
          },
        }),
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
