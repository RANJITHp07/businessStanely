import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasAdvisorRole } from "@/lib/agentRole";

const getAdvisorType = (agent: {
  agentType?: string | null;
  advisorAgentType?: string | null;
}) => agent.advisorAgentType || agent.agentType || null;

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agentId = params.id;
    const { transferAgentId } = await req.json();

    if (!transferAgentId) {
      return NextResponse.json(
        { error: "transferAgentId is required" },
        { status: 400 },
      );
    }

    if (agentId === transferAgentId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same agent" },
        { status: 400 },
      );
    }

    const [agent, transferAgent] = await Promise.all([
      prisma.agent.findUnique({ where: { id: agentId } }),
      prisma.agent.findUnique({ where: { id: transferAgentId } }),
    ]);

    if (!agent || agent.status === "inactive") {
      return NextResponse.json(
        { error: "Agent not found or already inactive" },
        { status: 404 },
      );
    }

    if (!transferAgent || transferAgent.status === "inactive") {
      return NextResponse.json(
        { error: "Transfer agent not found" },
        { status: 404 },
      );
    }

    if (
      !hasAdvisorRole(agent.agentRole) ||
      !hasAdvisorRole(transferAgent.agentRole)
    ) {
      return NextResponse.json(
        { error: "Both source and transfer agents must be advisor agents" },
        { status: 400 },
      );
    }

    const sourceAdvisorType = getAdvisorType(agent);
    const targetAdvisorType = getAdvisorType(transferAgent);

    if (
      sourceAdvisorType === "Lead Maker" &&
      targetAdvisorType !== "Lead Maker"
    ) {
      return NextResponse.json(
        { error: "Lead Maker can only be transferred to another Lead Maker" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // Transfer leads assigned to this advisor.
      await tx.prospect.updateMany({
        where: { assignedAgentId: agentId },
        data: { assignedAgentId: transferAgentId },
      });

      // Transfer leads created by this advisor (important for Lead Maker flow).
      await tx.prospect.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferAgentId },
      });

      // Reassign team members (subordinates) to transfer advisor, avoiding duplicates.
      const subordinateLinks = await tx.agentSuperior.findMany({
        where: { superiorId: agentId },
      });

      for (const link of subordinateLinks) {
        const existing = await tx.agentSuperior.findFirst({
          where: {
            superiorId: transferAgentId,
            subordinateId: link.subordinateId,
          },
        });

        if (existing) {
          await tx.agentSuperior.delete({ where: { id: existing.id } });
        }
      }

      await tx.agentSuperior.updateMany({
        where: { superiorId: agentId },
        data: { superiorId: transferAgentId },
      });

      // Soft delete advisor.
      await tx.agent.update({
        where: { id: agentId },
        data: { status: "inactive" },
      });
    });

    return NextResponse.json({
      success: true,
      message:
        "Advisor agent deactivated, leads/opportunities ownership transferred, and team reassigned",
    });
  } catch (error) {
    console.error("Error transferring advisor agent data:", error);
    return NextResponse.json(
      { error: "Failed to transfer advisor agent data" },
      { status: 500 },
    );
  }
}
