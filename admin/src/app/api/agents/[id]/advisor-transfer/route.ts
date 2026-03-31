import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasAdvisorRole } from "@/lib/agentRole";
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

const getAdvisorType = (agent: {
  agentType?: string | null;
  advisorAgentType?: string | null;
}) => agent.advisorAgentType || agent.agentType || null;

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

    const result = await prisma.$transaction(async (tx) => {
      const allTaskStatuses = await tx.task.findMany({
        where: { assignedToId: agentId },
        select: { status: true, completed: true },
      });

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

      const assignedLeads = await tx.prospect.findMany({
        where: { assignedAgentId: agentId },
        select: { id: true },
      });

      const createdLeads = await tx.prospect.findMany({
        where: { createdByAgentId: agentId },
        select: { id: true },
      });

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

      // Transfer non-completed tasks and archive completed tasks.
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

      const summary = {
        sourceAgentId: agentId,
        sourceAgentStatus: "inactive",
        transferredToAgentId: transferAgentId,
        transferredAt: new Date().toISOString(),
        assignedLeadsTransferredCount: assignedLeads.length,
        createdLeadsTransferredCount: createdLeads.length,
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
        "Advisor agent deactivated, data transferred, and completion/status snapshot stored",
      summary: result,
    });
  } catch (error) {
    console.error("Error transferring advisor agent data:", error);
    return NextResponse.json(
      { error: "Failed to transfer advisor agent data" },
      { status: 500 },
    );
  }
}
