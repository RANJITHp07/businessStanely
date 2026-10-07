import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NOT_DELETED } from "@/lib/softDelete";
import { getCurrentAdmin } from "@/lib/auth";
import { canOwnLeads } from "@/lib/agentRole";
import { actorFromAdmin, recordUpdateAudit } from "@/lib/audit";
import { withActor } from "@/lib/auditContext";

/**
 * Bulk-transfer selected leads and/or opportunities to another advisor.
 *
 * Unlike /api/agents/[id]/reassign, which hands over everything one agent
 * holds, this moves exactly the rows the admin ticked, and they may come from
 * several advisors at once.
 *
 * An opportunity has no owner of its own: it follows its prospect's
 * assignedAgentId. Transferring an opportunity therefore reassigns its
 * prospect, which also moves any other opportunity on that same prospect. The
 * response reports the opportunity count so the UI can say so.
 *
 * Only the assignment moves. createdByAgentId is left alone so Lead Maker
 * credit and the "Created By" column stay accurate.
 */

/** Caps one request so a runaway selection cannot fan out unbounded audits. */
const MAX_BULK_TRANSFER = 500;

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function readIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((id) => typeof id === "string" && OBJECT_ID.test(id))) {
    return null;
  }
  return Array.from(new Set(value as string[]));
}

export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const prospectIds = readIds(body?.prospectIds);
    const opportunityIds = readIds(body?.opportunityIds);
    const toAgentId: unknown = body?.toAgentId;

    if (!prospectIds || !opportunityIds) {
      return NextResponse.json(
        { error: "prospectIds and opportunityIds must be arrays of ids" },
        { status: 400 },
      );
    }

    if (prospectIds.length === 0 && opportunityIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one lead or opportunity to transfer" },
        { status: 400 },
      );
    }

    if (prospectIds.length + opportunityIds.length > MAX_BULK_TRANSFER) {
      return NextResponse.json(
        {
          error: `At most ${MAX_BULK_TRANSFER} records can be transferred at once`,
        },
        { status: 400 },
      );
    }

    if (typeof toAgentId !== "string" || !OBJECT_ID.test(toAgentId)) {
      return NextResponse.json(
        { error: "toAgentId is required" },
        { status: 400 },
      );
    }

    const toAgent = await prisma.agent.findUnique({
      where: { id: toAgentId },
      select: {
        id: true,
        name: true,
        status: true,
        agentRole: true,
        agentType: true,
        advisorAgentType: true,
      },
    });

    if (!toAgent || !canOwnLeads(toAgent)) {
      return NextResponse.json(
        {
          error:
            "Leads can only be transferred to an active Client Advisor or Client Manager",
        },
        { status: 400 },
      );
    }

    // Reads go through the soft-delete extension, so deleted opportunities
    // and prospects drop out here and are reported as not found.
    const opportunities = opportunityIds.length
      ? await prisma.opportunity.findMany({
          where: { id: { in: opportunityIds } },
          select: { prospectId: true },
        })
      : [];

    const targetProspectIds = Array.from(
      new Set([...prospectIds, ...opportunities.map((o) => o.prospectId)]),
    );

    const prospects = await prisma.prospect.findMany({
      where: { id: { in: targetProspectIds } },
      select: {
        id: true,
        name: true,
        assignedAgentId: true,
        assignedAgent: { select: { name: true } },
      },
    });

    const toMove = prospects.filter((p) => p.assignedAgentId !== toAgentId);
    const alreadyAssignedCount = prospects.length - toMove.length;

    const found = new Set(prospects.map((p) => p.id));
    const notFoundCount =
      prospectIds.filter((id) => !found.has(id)).length +
      opportunityIds.length -
      opportunities.filter((o) => found.has(o.prospectId)).length;

    if (toMove.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          toAgentId,
          toAgentName: toAgent.name,
          leadsTransferredCount: 0,
          opportunitiesTransferredCount: 0,
          alreadyAssignedCount,
          notFoundCount,
        },
      });
    }

    const moveIds = toMove.map((p) => p.id);
    const actor = actorFromAdmin(currentAdmin);

    // Every opportunity on a moved prospect moves with it, selected or not.
    const opportunitiesTransferredCount = await prisma.opportunity.count({
      where: { prospectId: { in: moveIds } },
    });

    // Writes are not rewritten by the extension, so the not-deleted guard is
    // spelled out. It covers a prospect deleted between the read and here.
    const moved = await withActor(actor, () =>
      prisma.prospect.updateMany({
        where: { id: { in: moveIds }, OR: [...NOT_DELETED.OR] },
        data: { assignedAgentId: toAgentId },
      }),
    );

    await Promise.all(
      toMove.map((p) =>
        recordUpdateAudit({
          entityType: "Prospect",
          entityId: p.id,
          entityName: p.name,
          changedFields: ["assignedAgentId"],
          reason: `Bulk transfer from ${p.assignedAgent?.name ?? "Unassigned"} to ${toAgent.name}`,
          actor,
          req,
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      summary: {
        toAgentId,
        toAgentName: toAgent.name,
        leadsTransferredCount: moved.count,
        opportunitiesTransferredCount,
        alreadyAssignedCount,
        notFoundCount,
      },
    });
  } catch (error) {
    console.error("Error bulk transferring leads:", error);
    return NextResponse.json(
      { error: "Failed to transfer leads" },
      { status: 500 },
    );
  }
}
