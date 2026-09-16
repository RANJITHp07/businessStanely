import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { NOT_DELETED } from "@/lib/softDelete";
import { getCurrentAdmin } from "@/lib/auth";
import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";

/**
 * Reassign an active agent's live workload to another agent.
 *
 * Unlike the delete-time transfer routes (transfer / advisor-transfer /
 * dual-transfer) this never deactivates the source agent: it is a plain
 * handover for an agent who stays on the team. Completed and abandoned tasks
 * stay with the source agent so their history is untouched.
 *
 * Scopes:
 *  - "tasks"     -> open tasks + task ownership (execution role)
 *  - "prospects" -> prospects assigned to the agent, and their opportunities
 *                   (an opportunity has no owner of its own; it follows its
 *                   prospect)
 */

type Scope = "tasks" | "prospects";

/**
 * Shared by the preview counts and the updateMany that performs the handover,
 * so both must agree or the reported count will not match what moved. The
 * extension does not rewrite writes, so the not-deleted condition is spelled
 * out here -- as NOT_DELETED, which also matches rows where the field is
 * absent. A literal `deletedAt: null` would match none of those on MongoDB.
 */
const OPEN_TASK_FILTER: Prisma.TaskWhereInput = {
  status: { notIn: ["Completed", "Abandoned"] },
  OR: [...NOT_DELETED.OR],
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [openTasks, ownedTasks, prospects, opportunities] = await Promise.all([
      prisma.task.count({
        where: { assignedToId: agentId, ...OPEN_TASK_FILTER },
      }),
      prisma.task.count({
        where: { ownerShipId: agentId, ...OPEN_TASK_FILTER },
      }),
      prisma.prospect.count({
        where: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
      }),
      prisma.opportunity.count({
        where: {
          OR: [...NOT_DELETED.OR],
          prospect: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
        },
      }),
    ]);

    return NextResponse.json({
      agentId,
      agentRole: agent.agentRole,
      canTransferTasks: hasExecutionRole(agent.agentRole),
      canTransferProspects: hasAdvisorRole(agent.agentRole),
      counts: { openTasks, ownedTasks, prospects, opportunities },
    });
  } catch (error) {
    console.error("Error loading agent reassign summary:", error);
    return NextResponse.json(
      { error: "Failed to load transfer summary" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;
    const body = await req.json();

    const scopes: Scope[] = Array.isArray(body.scopes) ? body.scopes : [];
    const taskTransferAgentId: string | undefined = body.taskTransferAgentId;
    const prospectTransferAgentId: string | undefined =
      body.prospectTransferAgentId;

    const transferTasks = scopes.includes("tasks");
    const transferProspects = scopes.includes("prospects");

    if (!transferTasks && !transferProspects) {
      return NextResponse.json(
        { error: "Select at least one thing to transfer" },
        { status: 400 },
      );
    }

    if (transferTasks && !taskTransferAgentId) {
      return NextResponse.json(
        { error: "taskTransferAgentId is required to transfer tasks" },
        { status: 400 },
      );
    }

    if (transferProspects && !prospectTransferAgentId) {
      return NextResponse.json(
        { error: "prospectTransferAgentId is required to transfer leads" },
        { status: 400 },
      );
    }

    if (
      (transferTasks && taskTransferAgentId === agentId) ||
      (transferProspects && prospectTransferAgentId === agentId)
    ) {
      return NextResponse.json(
        { error: "Cannot transfer to the same agent" },
        { status: 400 },
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.status === "inactive") {
      return NextResponse.json(
        { error: "Agent not found or inactive" },
        { status: 404 },
      );
    }

    if (transferTasks && !hasExecutionRole(agent.agentRole)) {
      return NextResponse.json(
        { error: "Only an execution agent has tasks to transfer" },
        { status: 400 },
      );
    }

    if (transferProspects && !hasAdvisorRole(agent.agentRole)) {
      return NextResponse.json(
        { error: "Only an advisor agent has leads to transfer" },
        { status: 400 },
      );
    }

    const [taskAgent, prospectAgent] = await Promise.all([
      transferTasks
        ? prisma.agent.findUnique({ where: { id: taskTransferAgentId } })
        : Promise.resolve(null),
      transferProspects
        ? prisma.agent.findUnique({ where: { id: prospectTransferAgentId } })
        : Promise.resolve(null),
    ]);

    if (transferTasks) {
      if (!taskAgent || taskAgent.status === "inactive") {
        return NextResponse.json(
          { error: "Task transfer agent not found" },
          { status: 404 },
        );
      }
      if (!hasExecutionRole(taskAgent.agentRole)) {
        return NextResponse.json(
          { error: "Tasks can only be transferred to an execution agent" },
          { status: 400 },
        );
      }
    }

    if (transferProspects) {
      if (!prospectAgent || prospectAgent.status === "inactive") {
        return NextResponse.json(
          { error: "Lead transfer agent not found" },
          { status: 404 },
        );
      }
      if (!hasAdvisorRole(prospectAgent.agentRole)) {
        return NextResponse.json(
          { error: "Leads can only be transferred to an advisor agent" },
          { status: 400 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let tasksTransferredCount = 0;
      let taskOwnershipTransferredCount = 0;
      let prospectsTransferredCount = 0;
      let opportunitiesTransferredCount = 0;

      if (transferTasks) {
        const openTasks = await tx.task.updateMany({
          where: { assignedToId: agentId, ...OPEN_TASK_FILTER },
          data: { assignedToId: taskTransferAgentId },
        });
        tasksTransferredCount = openTasks.count;

        // Ownership follows the open work; completed tasks keep their history
        // on the source agent, so only ownership of still-live tasks moves.
        const owned = await tx.task.updateMany({
          where: { ownerShipId: agentId, ...OPEN_TASK_FILTER },
          data: { ownerShipId: taskTransferAgentId },
        });
        taskOwnershipTransferredCount = owned.count;
      }

      if (transferProspects) {
        // Opportunities are counted before the move because they are found
        // through their prospect's assignment.
        opportunitiesTransferredCount = await tx.opportunity.count({
          where: {
            OR: [...NOT_DELETED.OR],
            prospect: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
          },
        });

        const prospects = await tx.prospect.updateMany({
          where: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
          data: { assignedAgentId: prospectTransferAgentId },
        });
        prospectsTransferredCount = prospects.count;
      }

      const summary = {
        sourceAgentId: agentId,
        sourceAgentStatus: agent.status,
        transferredAt: new Date().toISOString(),
        scopes,
        taskTransferredToAgentId: transferTasks ? taskTransferAgentId : null,
        prospectTransferredToAgentId: transferProspects
          ? prospectTransferAgentId
          : null,
        tasksTransferredCount,
        taskOwnershipTransferredCount,
        prospectsTransferredCount,
        opportunitiesTransferredCount,
      };

      await tx.serviceRecord.create({
        data: {
          agentId,
          createdBy: currentAdmin.id,
          note: `MANUAL_TRANSFER_AUDIT ${JSON.stringify(summary)}`,
        },
      });

      return summary;
    });

    return NextResponse.json({
      success: true,
      message: "Work transferred successfully. The agent remains active.",
      summary: result,
    });
  } catch (error) {
    console.error("Error reassigning agent work:", error);
    return NextResponse.json(
      { error: "Failed to transfer work" },
      { status: 500 },
    );
  }
}
