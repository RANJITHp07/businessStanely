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
    const body = await req.json();
    const transferAgentId: string | undefined = body.transferAgentId;
    const transferLeadsAgentId: string | undefined = body.transferLeadsAgentId;

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

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    const taskAgent = await prisma.agent.findUnique({ where: { id: transferAgentId } });
    const leadsAgent = await prisma.agent.findUnique({ where: { id: transferLeadsAgentId } });

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

    // Collect data before transaction
    const tasksToTransfer = await prisma.task.findMany({
      where: { assignedToId: agentId, status: { notIn: ["Completed", "Abandoned"] } },
      select: { id: true },
    });

    const completedTasks = await prisma.task.findMany({
      where: { assignedToId: agentId, status: { in: ["Completed", "Abandoned"] } },
      select: { id: true, status: true, completed: true },
    });

    const allTaskStatuses = await prisma.task.findMany({
      where: { assignedToId: agentId },
      select: { status: true, completed: true },
    });

    const assignedLeads = await prisma.prospect.findMany({
      where: { assignedAgentId: agentId },
      select: { id: true, status: true },
    });

    const createdLeads = await prisma.prospect.findMany({
      where: { createdByAgentId: agentId },
      select: { id: true },
    });

    const assignedQuoteRequests = await prisma.quoteRequest.findMany({
      where: { assignedAgentId: agentId },
      select: { id: true, status: true },
    });

    const createdQuoteRequests = await prisma.quoteRequest.findMany({
      where: { createdByAgentId: agentId },
      select: { id: true, status: true },
    });

    const diaryEntries = await prisma.diaryEntry.findMany({
      where: { createdByAgentId: agentId },
      select: { id: true },
    });

    const subordinateLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: agentId },
    });

    // Execute all mutations in a transaction
    await prisma.$transaction(async (tx) => {
      // Transfer non-completed tasks to execution agent
      await tx.task.updateMany({
        where: { assignedToId: agentId, status: { notIn: ["Completed", "Abandoned"] } },
        data: { assignedToId: transferAgentId },
      });

      // Archive completed/abandoned tasks
      await tx.task.updateMany({
        where: { assignedToId: agentId, status: { in: ["Completed", "Abandoned"] } },
        data: { active: false },
      });

      // Transfer task ownership to execution agent
      await tx.task.updateMany({
        where: { ownerShipId: agentId },
        data: { ownerShipId: transferAgentId },
      });

      // Transfer leads to advisor agent
      await tx.prospect.updateMany({
        where: { assignedAgentId: agentId },
        data: { assignedAgentId: transferLeadsAgentId },
      });

      await tx.prospect.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferLeadsAgentId },
      });

      // Transfer quote requests to execution agent
      await tx.quoteRequest.updateMany({
        where: { assignedAgentId: agentId },
        data: { assignedAgentId: transferAgentId },
      });

      await tx.quoteRequest.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferAgentId },
      });

      // Transfer diary entries to execution agent
      await tx.diaryEntry.updateMany({
        where: { createdByAgentId: agentId },
        data: { createdByAgentId: transferAgentId },
      });

      // Reassign subordinates to execution agent, avoiding duplicates
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

      // Soft delete the dual agent
      await tx.agent.update({
        where: { id: agentId },
        data: {
          status: "inactive",
          email: buildArchivedAgentEmail(agent.email, agent.id),
        },
      });
    });

    // Build summary and audit record outside the transaction
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

    await prisma.serviceRecord.create({
      data: {
        agentId,
        createdBy: currentAdmin.id,
        note: `AUTO_TRANSFER_AUDIT ${JSON.stringify(summary)}`,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Dual agent deleted: tasks transferred to execution agent, leads transferred to advisor agent",
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error deleting dual agent:", message);
    return NextResponse.json(
      { error: "Failed to delete dual agent", detail: message },
      { status: 500 },
    );
  }
}
