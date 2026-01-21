import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
        { error: "Cannot transfer tasks to the same agent" },
        { status: 400 },
      );
    }

    const [agent, transferAgent] = await Promise.all([
      prisma.agent.findUnique({ where: { id: agentId } }),
      prisma.agent.findUnique({ where: { id: transferAgentId } }),
    ]);

    if (!agent || agent.status === "inactive") {
      return NextResponse.json(
        { error: "Agent not found or already deleted" },
        { status: 404 },
      );
    }

    if (!transferAgent || transferAgent.status === "inactive") {
      return NextResponse.json(
        { error: "Transfer agent not found" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // Transfer tasks not completed
      await tx.task.updateMany({
        where: {
          assignedToId: agentId,
          status: { notIn: ["Completed"] },
        },
        data: { assignedToId: transferAgentId },
      });

      // Mark completed tasks as inactive
      await tx.task.updateMany({
        where: { assignedToId: agentId, status: "Completed" },
        data: { active: false },
      });

      // Delete existing AgentSuperior records if the subordinate is already under transferAgent
      const subordinatesLinks = await tx.agentSuperior.findMany({
        where: { superiorId: agentId },
      });

      for (const link of subordinatesLinks) {
        const exists = await tx.agentSuperior.findFirst({
          where: {
            superiorId: transferAgentId,
            subordinateId: link.subordinateId,
          },
        });

        if (exists) {
          await tx.agentSuperior.delete({ where: { id: exists.id } });
        }
      }

      // Reassign remaining subordinates to the transfer agent
      await tx.agentSuperior.updateMany({
        where: { superiorId: agentId },
        data: { superiorId: transferAgentId },
      });

      // Soft delete the agent
      await tx.agent.update({
        where: { id: agentId },
        data: { status: "inactive" },
      });
    });

    return NextResponse.json({
      success: true,
      message:
        "Agent soft deleted, tasks transferred, and subordinates reassigned successfully",
    });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 },
    );
  }
}
