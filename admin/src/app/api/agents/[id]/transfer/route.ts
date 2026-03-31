import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const result = await prisma.$transaction(async (tx) => {
      const tasksToTransfer = await tx.task.findMany({
        where: {
          assignedToId: agentId,
          status: { notIn: ["Completed", "Abandoned"] },
        },
        select: { id: true },
      });

      const completedTasks = await tx.task.findMany({
        where: {
          assignedToId: agentId,
          status: { in: ["Completed", "Abandoned"] },
        },
        select: { id: true, status: true, completed: true },
      });

      const allTaskStatuses = await tx.task.findMany({
        where: { assignedToId: agentId },
        select: { status: true, completed: true },
      });

      // Transfer tasks not completed.
      await tx.task.updateMany({
        where: {
          assignedToId: agentId,
          status: { notIn: ["Completed", "Abandoned"] },
        },
        data: { assignedToId: transferAgentId },
      });

      // Keep completed/abandoned tasks on source agent but archive them.
      await tx.task.updateMany({
        where: {
          assignedToId: agentId,
          status: { in: ["Completed", "Abandoned"] },
        },
        data: { active: false },
      });

      const [assignedQuoteRequests, createdQuoteRequests, diaryEntries] =
        await Promise.all([
          tx.quoteRequest.findMany({
            where: { assignedAgentId: agentId },
            select: { id: true, status: true },
          }),
          tx.quoteRequest.findMany({
            where: { createdByAgentId: agentId },
            select: { id: true, status: true },
          }),
          tx.diaryEntry.findMany({
            where: { createdByAgentId: agentId },
            select: { id: true },
          }),
        ]);

      await tx.quoteRequest.updateMany({
        where: { assignedAgentId: agentId },
        data: { assignedAgentId: transferAgentId },
      });

      await tx.quoteRequest.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferAgentId },
      });

      await tx.diaryEntry.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferAgentId },
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

      const taskStatusBreakdown = allTaskStatuses.reduce(
        (acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const quoteStatusBreakdown = assignedQuoteRequests.reduce(
        (acc, quote) => {
          acc[quote.status] = (acc[quote.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const completedTaskCount = completedTasks.filter(
        (task) => task.completed || task.status === "Completed",
      ).length;

      const summary = {
        sourceAgentId: agentId,
        sourceAgentStatus: "inactive",
        transferredToAgentId: transferAgentId,
        transferredAt: new Date().toISOString(),
        tasksTransferredCount: tasksToTransfer.length,
        completedOrAbandonedTasksArchivedCount: completedTasks.length,
        completedTaskCount,
        taskStatusBreakdown,
        assignedQuoteRequestsTransferredCount: assignedQuoteRequests.length,
        createdQuoteRequestsTransferredCount: createdQuoteRequests.length,
        quoteStatusBreakdown,
        diaryEntriesTransferredCount: diaryEntries.length,
      };

      await tx.serviceRecord.create({
        data: {
          agentId,
          createdBy: currentAdmin.id,
          note: `AUTO_TRANSFER_AUDIT ${JSON.stringify(summary)}`,
        },
      });

      return summary;
    });

    return NextResponse.json({
      success: true,
      message:
        "Agent soft deleted, tasks/leads-related data transferred, and status snapshot stored successfully",
      summary: result,
    });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 },
    );
  }
}
