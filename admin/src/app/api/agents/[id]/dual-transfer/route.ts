import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasExecutionRole, hasAdvisorRole } from "@/lib/agentRole";
import { getCurrentAdmin } from "@/lib/auth";

const buildArchivedAgentEmail = (email: string, agentId: string) => {
  const normalized = email.toLowerCase();
  const [localPart, domainPart] = normalized.split("@");
  const suffix = `inactive-${agentId.slice(-6)}-${Date.now()}`;

  if (localPart && domainPart) {
    return `${localPart}+${suffix}@${domainPart}`;
  }

  return `${normalized}.${suffix}`;
};

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
    const { transferAgentId, transferLeadsAgentId } = await req.json();

    if (!transferAgentId) {
      return NextResponse.json(
        { error: "transferAgentId is required" },
        { status: 400 },
      );
    }

    if (!transferLeadsAgentId) {
      return NextResponse.json(
        { error: "transferLeadsAgentId is required" },
        { status: 400 },
      );
    }

    if (agentId === transferAgentId || agentId === transferLeadsAgentId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same agent being deleted" },
        { status: 400 },
      );
    }

    const [agent, taskAgent, leadsAgent] = await Promise.all([
      prisma.agent.findUnique({ where: { id: agentId } }),
      prisma.agent.findUnique({ where: { id: transferAgentId } }),
      prisma.agent.findUnique({ where: { id: transferLeadsAgentId } }),
    ]);

    if (!agent || agent.status === "inactive") {
      return NextResponse.json(
        { error: "Agent not found or already deleted" },
        { status: 404 },
      );
    }

    if (!hasExecutionRole(agent.agentRole) || !hasAdvisorRole(agent.agentRole)) {
      return NextResponse.json(
        { error: "Agent being deleted must have both execution and advisor roles" },
        { status: 400 },
      );
    }

    if (!taskAgent || taskAgent.status === "inactive") {
      return NextResponse.json(
        { error: "Task transfer agent not found" },
        { status: 404 },
      );
    }

    if (!hasExecutionRole(taskAgent.agentRole)) {
      return NextResponse.json(
        { error: "Task transfer agent must have execution role" },
        { status: 400 },
      );
    }

    if (!leadsAgent || leadsAgent.status === "inactive") {
      return NextResponse.json(
        { error: "Leads transfer agent not found" },
        { status: 404 },
      );
    }

    if (!hasAdvisorRole(leadsAgent.agentRole)) {
      return NextResponse.json(
        { error: "Leads transfer agent must have advisor role" },
        { status: 400 },
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

      const assignedLeads = await tx.prospect.findMany({
        where: { assignedAgentId: agentId },
        select: { id: true, status: true },
      });

      const createdLeads = await tx.prospect.findMany({
        where: { createdByAgentId: agentId },
        select: { id: true },
      });

      // Transfer tasks to the execution agent
      await tx.task.updateMany({
        where: {
          assignedToId: agentId,
          status: { notIn: ["Completed", "Abandoned"] },
        },
        data: { assignedToId: transferAgentId },
      });

      await tx.task.updateMany({
        where: {
          assignedToId: agentId,
          status: { in: ["Completed", "Abandoned"] },
        },
        data: { active: false },
      });

      await tx.task.updateMany({
        where: { ownerShipId: agentId },
        data: { ownerShipId: transferAgentId },
      });

      // Transfer leads to the advisor agent
      await tx.prospect.updateMany({
        where: { assignedAgentId: agentId },
        data: { assignedAgentId: transferLeadsAgentId },
      });

      await tx.prospect.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferLeadsAgentId },
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

      // Reassign execution subordinates to the task agent
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

      // Soft delete the agent
      await tx.agent.update({
        where: { id: agentId },
        data: {
          status: "inactive",
          email: buildArchivedAgentEmail(agent.email, agent.id),
        },
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

      const convertedLeadsCount = assignedLeads.filter(
        (lead) => (lead.status || "").toLowerCase() === "converted",
      ).length;

      const summary = {
        sourceAgentId: agentId,
        sourceAgentStatus: "inactive",
        tasksTransferredToAgentId: transferAgentId,
        leadsTransferredToAgentId: transferLeadsAgentId,
        transferredAt: new Date().toISOString(),
        tasksTransferredCount: tasksToTransfer.length,
        completedOrAbandonedTasksArchivedCount: completedTasks.length,
        completedTaskCount,
        taskStatusBreakdown,
        assignedLeadsTransferredCount: assignedLeads.length,
        createdLeadsTransferredCount: createdLeads.length,
        convertedLeadsCount,
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
        "Dual agent deleted: tasks transferred to execution agent, leads transferred to advisor agent",
      summary: result,
    });
  } catch (error) {
    console.error("Error deleting dual agent:", error);
    return NextResponse.json(
      { error: "Failed to delete dual agent" },
      { status: 500 },
    );
  }
}
