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
    const where: Record<string, unknown> = { archived: false, status: { not: "opportunity" } };
    if (agent.agentType === "Lead Maker") {
      where.createdByAgentId = agent.id;
    } else if (agent.agentType === "Client Advisor" || agent.agentType === "Client Manager") {
      where.assignedAgentId = agent.id;
    }
    const prospects = await prisma.prospect.findMany({
      where,
      include: { assignedAgent: true, createdByAgent: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ prospects });
  } catch {
    return NextResponse.json({ error: "Failed to fetch prospects" }, { status: 500 });
  }
}

// POST: Create a new prospect
export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { name, email, phone, phoneNumber, description, status, notes, nextFollowUp, assignedAgentId, leadSource, amount } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    // For Client Advisor/Manager, assignedAgentId is required
    if ((agent.agentType === "Client Advisor" || agent.agentType === "Client Manager") && !assignedAgentId) {
      return NextResponse.json({ error: "Assigned agent is required for this role." }, { status: 400 });
    }
    let finalAssignedAgentId = assignedAgentId;
    // For any agent, if no assignment, use round robin to assign to Client Manager/Advisor (not self)
    if (!assignedAgentId) {
      // Get all eligible agents (Client Manager/Advisor, active, not the creator)
      const eligibleAgents = await prisma.agent.findMany({
        where: {
          agentType: { in: ["Client Manager", "Client Advisor"] },
          status: "active",
          id: { not: agent.id },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });
      if (eligibleAgents.length > 0) {
        // Find the last assigned prospect to get the last agent used
        const lastProspect = await prisma.prospect.findFirst({
          where: {
            assignedAgentId: { in: eligibleAgents.map(a => a.id) },
          },
          orderBy: { createdAt: "desc" },
          select: { assignedAgentId: true },
        });
        let nextIndex = 0;
        if (lastProspect && lastProspect.assignedAgentId) {
          const lastIndex = eligibleAgents.findIndex(a => a.id === lastProspect.assignedAgentId);
          nextIndex = (lastIndex + 1) % eligibleAgents.length;
        }
        finalAssignedAgentId = eligibleAgents[nextIndex].id;
      }
    }
    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        phone,
        phoneNumber,
        description,
        leadSource,
        status: status || "New",
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        assignedAgentId: finalAssignedAgentId,
        createdByAgentId: agent.id,
        amount: typeof amount === 'number' ? amount : undefined,
      },
      include: { createdByAgent: true, assignedAgent: true },
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create prospect" }, { status: 500 });
  }
}
