import type { Agent, Prisma } from "@prisma/client";
import prisma, { prismaRaw } from "@/lib/prisma";
import { NOT_DELETED } from "@/lib/softDelete";
import { restoreData, softDeleteData, type AuditActor } from "@/lib/audit";
import {
  ADVISOR_AGENT_ROLE,
  EXECUTION_AGENT_ROLE,
  EXECUTION_AND_ADVISOR_AGENT_ROLE,
  getAdvisorType,
  hasAdvisorRole,
  hasExecutionRole,
} from "@/lib/agentRole";
import {
  buildArchivedAgentEmail,
  sanitizeInactiveAgentEmail,
} from "@/lib/agentEmail";

/**
 * Deleting an agent, or removing one role from a dual-role agent.
 *
 * Mirrors the client delete: the admin either soft deletes, which hides the
 * agent's open work along with the agent so it all comes back on restore, or
 * transfers that work to another agent first. "Agent" deletes the whole agent;
 * "execution" / "advisor" strip that one role from a dual-role agent, who stays
 * active with the other.
 *
 * Every removal writes an AUTO_TRANSFER_AUDIT service record. Besides the stats
 * the agent page reads for a deleted agent, it carries what a restore needs:
 * the agent's previous role and email, and `hiddenAt`, the exact timestamp
 * stamped on every row hidden by this removal. Restore matches rows on that
 * timestamp, the same way a client restore only brings back rows deleted in
 * the same action.
 */

export type RemovalScope = "agent" | "execution" | "advisor";
export type RemovalMode = "transfer" | "soft-delete";

export const REMOVAL_AUDIT_PREFIX = "AUTO_TRANSFER_AUDIT ";
export const RESTORE_AUDIT_PREFIX = "AUTO_RESTORE_AUDIT ";

const DONE_TASK_STATUSES = ["Completed", "completed", "Abandoned", "abandoned"];
// A lead that became an opportunity or a client is no longer open work.
const CLOSED_LEAD_STATUSES = ["opportunity", "Opportunity", "Converted", "converted"];
const CLOSED_OPPORTUNITY_STATUSES = [
  "Closed as Won",
  "Closed as Loss",
  "Closed as Lost",
  "closed as won",
  "closed as loss",
  "closed as lost",
];

const notDeleted = (): Prisma.TaskWhereInput => ({ OR: [...NOT_DELETED.OR] });

type Team = "execution" | "advisor";

// Links saved before teamType existed have none and count as execution links,
// matching how the agent APIs split teams.
const teamWhere = (team: Team): Prisma.AgentSuperiorWhereInput =>
  team === "advisor" ? { teamType: "advisor" } : { teamType: { not: "advisor" } };

export class AgentRemovalError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The audit payload stored on the service record. */
export interface RemovalAudit {
  action: "delete" | "remove-role";
  mode: RemovalMode;
  removedRole?: Team;
  sourceAgentId: string;
  sourceAgentStatus: "inactive" | "active";
  performedAt: string;
  /** Exact deletedAt stamped on the rows hidden by a soft delete. */
  hiddenAt?: string;
  previous: {
    agentRole: string;
    agentType: string;
    executionAgentType: string | null;
    advisorAgentType: string | null;
    email: string;
  };
  tasksTransferredToAgentId?: string | null;
  leadsTransferredToAgentId?: string | null;
  tasksTransferredCount: number;
  tasksHiddenCount: number;
  legislationsTransferredCount: number;
  legislationsHiddenCount: number;
  assignedLeadsTransferredCount: number;
  leadsHiddenCount: number;
  opportunitiesHiddenCount: number;
  // Read by the agent page as the deleted agent's frozen stats.
  taskStatusBreakdown: Record<string, number>;
  completedTaskCount: number;
  convertedLeadsCount: number;
  opportunitiesClosedWonCount: number;
  opportunitiesClosedLossCount: number;
}

type CountKey =
  | "tasksTransferredCount"
  | "tasksHiddenCount"
  | "legislationsTransferredCount"
  | "legislationsHiddenCount"
  | "leadsHiddenCount"
  | "opportunitiesHiddenCount";

/** Counts shown in the delete dialog before the admin chooses. */
export async function getRemovalSummary(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new AgentRemovalError(404, "Agent not found");

  const leadIds = (
    await prisma.prospect.findMany({
      where: { assignedAgentId: agentId },
      select: { id: true },
    })
  ).map((lead) => lead.id);

  const [openTasks, completedTasks, legislations, openLeads, openOpportunities] =
    await Promise.all([
      prisma.task.count({
        where: { assignedToId: agentId, status: { notIn: DONE_TASK_STATUSES } },
      }),
      prisma.task.count({
        where: { assignedToId: agentId, status: { in: DONE_TASK_STATUSES } },
      }),
      prisma.legislation.count({ where: { assignedAgentId: agentId } }),
      prisma.prospect.count({
        where: {
          assignedAgentId: agentId,
          archived: { not: true },
          status: { notIn: CLOSED_LEAD_STATUSES },
        },
      }),
      leadIds.length
        ? prisma.opportunity.count({
            where: {
              prospectId: { in: leadIds },
              status: { notIn: CLOSED_OPPORTUNITY_STATUSES },
            },
          })
        : Promise.resolve(0),
    ]);

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      agentRole: agent.agentRole,
      agentType: agent.agentType,
      executionAgentType: agent.executionAgentType,
      advisorAgentType: agent.advisorAgentType,
    },
    execution: { openTasks, completedTasks, legislations },
    advisor: { openLeads, openOpportunities },
  };
}

async function loadTarget(
  targetId: string | undefined,
  agentId: string,
  team: Team,
): Promise<Agent> {
  const label = team === "execution" ? "Task" : "Leads";
  if (!targetId) {
    throw new AgentRemovalError(400, `${label} transfer agent is required`);
  }
  if (targetId === agentId) {
    throw new AgentRemovalError(400, "Cannot transfer to the agent being deleted");
  }
  const target = await prisma.agent.findUnique({ where: { id: targetId } });
  if (!target || target.status === "inactive") {
    throw new AgentRemovalError(404, `${label} transfer agent not found`);
  }
  const hasRole =
    team === "execution"
      ? hasExecutionRole(target.agentRole)
      : hasAdvisorRole(target.agentRole);
  if (!hasRole) {
    throw new AgentRemovalError(
      400,
      `${label} transfer agent must have the ${team} role`,
    );
  }
  return target;
}

/** Moves the agent's subordinates in one team to `toId`, skipping duplicates. */
async function moveSubordinates(
  tx: Prisma.TransactionClient,
  agentId: string,
  team: Team,
  toId: string,
) {
  const links = await tx.agentSuperior.findMany({
    where: { superiorId: agentId, ...teamWhere(team) },
  });

  for (const link of links) {
    const duplicate =
      link.subordinateId === toId ||
      (await tx.agentSuperior.findFirst({
        where: {
          superiorId: toId,
          subordinateId: link.subordinateId,
          ...teamWhere(team),
        },
      }));
    // The target already leads this subordinate, or is the subordinate.
    if (duplicate) await tx.agentSuperior.delete({ where: { id: link.id } });
  }

  await tx.agentSuperior.updateMany({
    where: { superiorId: agentId, ...teamWhere(team) },
    data: { superiorId: toId },
  });
}

export async function removeAgent(params: {
  agentId: string;
  scope: RemovalScope;
  mode: RemovalMode;
  transferAgentId?: string;
  transferLeadsAgentId?: string;
  actor: AuditActor;
  /** The admin user, recorded as the author of the audit service record. */
  adminId: string;
}) {
  const { agentId, scope, mode, actor } = params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status === "inactive") {
    throw new AgentRemovalError(404, "Agent not found or already deleted");
  }

  const isDual = agent.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE;
  if (scope !== "agent" && !isDual) {
    throw new AgentRemovalError(
      400,
      "Only a dual-role agent can have a single role removed. Delete the agent instead.",
    );
  }

  const fullDelete = scope === "agent";
  const agentHasExecution = hasExecutionRole(agent.agentRole);
  const agentHasAdvisor = hasAdvisorRole(agent.agentRole);
  // A full delete handles whatever task work the agent has, whichever role.
  const doExecution = fullDelete || scope === "execution";
  const doAdvisor = scope === "advisor" || (fullDelete && agentHasAdvisor);

  let executionTarget: Agent | null = null;
  let leadsTarget: Agent | null = null;
  if (mode === "transfer") {
    if (doExecution && agentHasExecution) {
      executionTarget = await loadTarget(params.transferAgentId, agentId, "execution");
    }
    if (doAdvisor) {
      leadsTarget = await loadTarget(params.transferLeadsAgentId, agentId, "advisor");
      if (
        getAdvisorType(agent) === "Lead Maker" &&
        getAdvisorType(leadsTarget) !== "Lead Maker"
      ) {
        throw new AgentRemovalError(
          400,
          "Lead Maker can only be transferred to another Lead Maker",
        );
      }
    }
  }
  // A pure advisor's tasks follow its leads, as the advisor delete always did.
  const executionWorkTarget = executionTarget ?? leadsTarget;

  // Stats are taken before anything moves, while the rows still point here.
  const assignedTasks = await prisma.task.findMany({
    where: { assignedToId: agentId },
    select: { status: true, completed: true },
  });
  const assignedLeads = doAdvisor
    ? await prisma.prospect.findMany({
        where: { assignedAgentId: agentId },
        select: { id: true, status: true },
      })
    : [];
  const leadIds = assignedLeads.map((lead) => lead.id);
  const leadOpportunities = leadIds.length
    ? await prisma.opportunity.findMany({
        where: { prospectId: { in: leadIds } },
        select: { status: true },
      })
    : [];

  const hiddenAt = mode === "soft-delete" ? new Date() : null;
  const hide = hiddenAt ? softDeleteData(actor, hiddenAt) : null;

  const statusOf = (status?: string | null) => (status || "").trim().toLowerCase();
  // Everything but the moved/hidden counts, which the transaction fills in.
  const baseAudit: Omit<RemovalAudit, CountKey> = {
    action: fullDelete ? "delete" : "remove-role",
    mode,
    ...(fullDelete ? {} : { removedRole: scope as Team }),
    sourceAgentId: agentId,
    sourceAgentStatus: fullDelete ? "inactive" : "active",
    performedAt: new Date().toISOString(),
    ...(hiddenAt ? { hiddenAt: hiddenAt.toISOString() } : {}),
    previous: {
      agentRole: agent.agentRole,
      agentType: agent.agentType,
      executionAgentType: agent.executionAgentType,
      advisorAgentType: agent.advisorAgentType,
      email: agent.email,
    },
    tasksTransferredToAgentId: executionWorkTarget?.id ?? null,
    leadsTransferredToAgentId: leadsTarget?.id ?? null,
    // Named for the stats the agent page already reads: the deleted agent's
    // lead total, whether those leads moved or were hidden.
    assignedLeadsTransferredCount: assignedLeads.length,
    taskStatusBreakdown: assignedTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {}),
    completedTaskCount: assignedTasks.filter(
      (task) => task.completed || task.status === "Completed",
    ).length,
    convertedLeadsCount: assignedLeads.filter(
      (lead) => statusOf(lead.status) === "converted",
    ).length,
    opportunitiesClosedWonCount: leadOpportunities.filter(
      (opportunity) => statusOf(opportunity.status) === "closed as won",
    ).length,
    opportunitiesClosedLossCount: leadOpportunities.filter((opportunity) =>
      ["closed as loss", "closed as lost"].includes(statusOf(opportunity.status)),
    ).length,
  };


  const audit = await prisma.$transaction(async (tx) => {
    let tasksTransferredCount = 0;
    let tasksHiddenCount = 0;
    let legislationsTransferredCount = 0;
    let legislationsHiddenCount = 0;
    let leadsHiddenCount = 0;
    let opportunitiesHiddenCount = 0;

    if (doExecution) {
      if (executionWorkTarget) {
        const to = executionWorkTarget.id;
        const open = await tx.task.updateMany({
          where: {
            assignedToId: agentId,
            status: { notIn: DONE_TASK_STATUSES },
            ...notDeleted(),
          },
          data: { assignedToId: to },
        });
        // A retainership is an ongoing engagement, so even its completed tasks
        // follow it to the new agent.
        const retainership = await tx.task.updateMany({
          where: { assignedToId: agentId, retainershipId: { not: null }, ...notDeleted() },
          data: { assignedToId: to },
        });
        tasksTransferredCount = open.count + retainership.count;

        if (fullDelete) {
          // Finished one-off work stays with the deleted agent as history, out
          // of the live lists.
          await tx.task.updateMany({
            where: {
              assignedToId: agentId,
              status: { in: DONE_TASK_STATUSES },
              AND: [
                notDeleted(),
                { OR: [{ retainershipId: null }, { retainershipId: { isSet: false } }] },
              ],
            },
            data: { active: false },
          });
        }

        await tx.task.updateMany({
          where: { ownerShipId: agentId, ...notDeleted() },
          data: { ownerShipId: to },
        });
        legislationsTransferredCount = (
          await tx.legislation.updateMany({
            where: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
            data: { assignedAgentId: to },
          })
        ).count;
        await tx.quoteRequest.updateMany({
          where: { assignedAgentId: agentId },
          data: { assignedAgentId: to },
        });
        await tx.quoteRequest.updateMany({
          where: { createdByAgentId: agentId },
          data: { createdByAgentId: to },
        });
        // A role removal leaves the agent in place, so its own diary stays.
        if (fullDelete) {
          await tx.diaryEntry.updateMany({
            where: { createdByAgentId: agentId, OR: [...NOT_DELETED.OR] },
            data: { createdByAgentId: to },
          });
        }
      } else if (hide) {
        tasksHiddenCount = (
          await tx.task.updateMany({
            where: {
              assignedToId: agentId,
              status: { notIn: DONE_TASK_STATUSES },
              ...notDeleted(),
            },
            data: hide,
          })
        ).count;
        legislationsHiddenCount = (
          await tx.legislation.updateMany({
            where: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
            data: hide,
          })
        ).count;
      }
    }

    if (doAdvisor) {
      if (leadsTarget) {
        await tx.prospect.updateMany({
          where: { assignedAgentId: agentId, OR: [...NOT_DELETED.OR] },
          data: { assignedAgentId: leadsTarget.id },
        });
        await tx.prospect.updateMany({
          where: { createdByAgentId: agentId, OR: [...NOT_DELETED.OR] },
          data: { createdByAgentId: leadsTarget.id },
        });
      } else if (hide) {
        leadsHiddenCount = (
          await tx.prospect.updateMany({
            where: {
              assignedAgentId: agentId,
              archived: { not: true },
              status: { notIn: CLOSED_LEAD_STATUSES },
              OR: [...NOT_DELETED.OR],
            },
            data: hide,
          })
        ).count;
        if (leadIds.length) {
          opportunitiesHiddenCount = (
            await tx.opportunity.updateMany({
              where: {
                prospectId: { in: leadIds },
                status: { notIn: CLOSED_OPPORTUNITY_STATUSES },
                OR: [...NOT_DELETED.OR],
              },
              data: hide,
            })
          ).count;
        }
      }
    }

    // Team links. A deleted agent's links are left alone on a soft delete:
    // the team views already skip inactive agents, and restore brings the
    // team back as it was.
    if (fullDelete) {
      if (mode === "transfer") {
        if (executionWorkTarget) {
          await moveSubordinates(tx, agentId, "execution", executionWorkTarget.id);
        }
        const advisorTeamTarget = leadsTarget ?? executionWorkTarget;
        if (advisorTeamTarget) {
          await moveSubordinates(tx, agentId, "advisor", advisorTeamTarget.id);
        }
      }
    } else {
      // The agent leaves the removed role's team entirely.
      const team = scope as Team;
      const target = team === "execution" ? executionTarget : leadsTarget;
      if (target) {
        await moveSubordinates(tx, agentId, team, target.id);
      } else {
        await tx.agentSuperior.deleteMany({
          where: { superiorId: agentId, ...teamWhere(team) },
        });
      }
      await tx.agentSuperior.deleteMany({
        where: { subordinateId: agentId, ...teamWhere(team) },
      });
    }

    if (fullDelete) {
      await tx.agent.update({
        where: { id: agentId },
        data: {
          status: "inactive",
          email: buildArchivedAgentEmail(agent.email, agent.id),
        },
      });
    } else if (scope === "execution") {
      const advisorType = getAdvisorType(agent);
      await tx.agent.update({
        where: { id: agentId },
        data: {
          agentRole: ADVISOR_AGENT_ROLE,
          agentType: advisorType ?? agent.agentType,
          advisorAgentType: advisorType,
          executionAgentType: null,
        },
      });
    } else {
      const executionType = agent.executionAgentType || agent.agentType;
      await tx.agent.update({
        where: { id: agentId },
        data: {
          agentRole: EXECUTION_AGENT_ROLE,
          agentType: executionType,
          executionAgentType: executionType,
          advisorAgentType: null,
        },
      });
    }

    const audit: RemovalAudit = {
      ...baseAudit,
      tasksTransferredCount,
      tasksHiddenCount,
      legislationsTransferredCount,
      legislationsHiddenCount,
      leadsHiddenCount,
      opportunitiesHiddenCount,
    };
    // Written in the same transaction: restore depends on this record, so a
    // removal must never commit without it.
    await tx.serviceRecord.create({
      data: {
        agentId,
        createdBy: params.adminId,
        note: `${REMOVAL_AUDIT_PREFIX}${JSON.stringify(audit)}`,
      },
    });
    return audit;
    // Well past the 5s default: an agent with a large team makes one round
    // trip per subordinate link, and a timeout here rolls the whole removal back.
  }, { maxWait: 10_000, timeout: 30_000 });

  return audit;
}

export interface RestorableRemoval {
  /** Service record of the removal; null for a delete made before audits had restore data. */
  recordId: string | null;
  kind: "delete" | "remove-role";
  removedRole?: Team;
  mode?: RemovalMode;
  at: string;
  audit: RemovalAudit | null;
}

/**
 * The most recent removal of this agent that has not been restored yet, or
 * null if there is nothing to restore.
 */
export async function findRestorableRemoval(agentId: string): Promise<RestorableRemoval | null> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return null;

  const records = await prisma.serviceRecord.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, note: true, createdAt: true },
  });

  const restored = new Set<string>();
  for (const record of records) {
    if (record.note.startsWith(RESTORE_AUDIT_PREFIX)) {
      try {
        const parsed = JSON.parse(record.note.slice(RESTORE_AUDIT_PREFIX.length));
        if (parsed.restoredRecordId) restored.add(parsed.restoredRecordId);
      } catch {
        // A malformed restore note restores nothing.
      }
      continue;
    }
    if (!record.note.startsWith(REMOVAL_AUDIT_PREFIX)) continue;

    let audit: RemovalAudit | null = null;
    try {
      audit = JSON.parse(record.note.slice(REMOVAL_AUDIT_PREFIX.length));
    } catch {
      continue;
    }
    if (!audit?.action) {
      // A delete from before restore data was recorded: only the agent itself
      // can come back.
      if (agent.status !== "inactive" || restored.has(record.id)) return null;
      return { recordId: record.id, kind: "delete", at: record.createdAt.toISOString(), audit: null };
    }
    if (restored.has(record.id)) return null;

    // Only the latest removal is restorable, and only while the agent is
    // still in the state it left.
    const stillApplies =
      audit.action === "delete"
        ? agent.status === "inactive"
        : agent.status !== "inactive" &&
          agent.agentRole ===
            (audit.removedRole === "execution" ? ADVISOR_AGENT_ROLE : EXECUTION_AGENT_ROLE);
    if (!stillApplies) return null;

    return {
      recordId: record.id,
      kind: audit.action,
      removedRole: audit.removedRole,
      mode: audit.mode,
      at: record.createdAt.toISOString(),
      audit,
    };
  }

  // Deleted without any audit record at all (very old deletes).
  if (agent.status === "inactive") {
    return { recordId: null, kind: "delete", at: agent.updatedAt.toISOString(), audit: null };
  }
  return null;
}

/**
 * Undoes the latest removal. Hidden work comes back; transferred work stays
 * where it was moved, exactly as with a client restore.
 */
export async function restoreAgent(agentId: string, adminId: string) {
  const removal = await findRestorableRemoval(agentId);
  if (!removal) {
    throw new AgentRemovalError(409, "Nothing to restore for this agent");
  }

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new AgentRemovalError(404, "Agent not found");

  const audit = removal.audit;

  let restoredEmail: string | null = null;
  if (removal.kind === "delete") {
    restoredEmail = (audit?.previous.email || sanitizeInactiveAgentEmail(agent.email)).toLowerCase();
    const taken = await prisma.agent.findFirst({
      where: { email: { equals: restoredEmail, mode: "insensitive" }, id: { not: agentId } },
      select: { name: true },
    });
    if (taken) {
      throw new AgentRemovalError(
        409,
        `${restoredEmail} is now used by ${taken.name}. Change that agent's email before restoring.`,
      );
    }
  }

  // The default client hides deleted prospects, so the ids are read from the
  // raw one, including the leads this removal hid.
  const hiddenAt = audit?.hiddenAt ? new Date(audit.hiddenAt) : null;
  const leadIds = hiddenAt
    ? (
        await prismaRaw.prospect.findMany({
          where: { assignedAgentId: agentId },
          select: { id: true },
        })
      ).map((lead) => lead.id)
    : [];

  const restoredCounts = await prisma.$transaction(async (tx) => {
    if (restoredEmail) {
      await tx.agent.update({
        where: { id: agentId },
        data: { status: "active", email: restoredEmail },
      });
    } else if (audit) {
      await tx.agent.update({
        where: { id: agentId },
        data: {
          agentRole: EXECUTION_AND_ADVISOR_AGENT_ROLE,
          agentType: audit.previous.agentType,
          executionAgentType: audit.previous.executionAgentType,
          advisorAgentType: audit.previous.advisorAgentType,
        },
      });
    }

    const counts = { tasks: 0, legislations: 0, leads: 0, opportunities: 0 };
    if (hiddenAt) {
      // Matched on the exact stamp this removal wrote, so rows deleted
      // separately before or after stay deleted. updateMany is not filtered by
      // the soft-delete extension, so the transaction client reaches them.
      const unhide = restoreData();
      counts.tasks = (
        await tx.task.updateMany({
          where: { assignedToId: agentId, deletedAt: hiddenAt },
          data: unhide,
        })
      ).count;
      counts.legislations = (
        await tx.legislation.updateMany({
          where: { assignedAgentId: agentId, deletedAt: hiddenAt },
          data: unhide,
        })
      ).count;
      counts.leads = (
        await tx.prospect.updateMany({
          where: { assignedAgentId: agentId, deletedAt: hiddenAt },
          data: unhide,
        })
      ).count;
      if (leadIds.length) {
        counts.opportunities = (
          await tx.opportunity.updateMany({
            where: { prospectId: { in: leadIds }, deletedAt: hiddenAt },
            data: unhide,
          })
        ).count;
      }
    }

    await tx.serviceRecord.create({
      data: {
        agentId,
        createdBy: adminId,
        note: `${RESTORE_AUDIT_PREFIX}${JSON.stringify({
          restoredRecordId: removal.recordId,
          kind: removal.kind,
          removedRole: removal.removedRole ?? null,
          restoredAt: new Date().toISOString(),
          restoredCounts: counts,
        })}`,
      },
    });

    return counts;
  }, { maxWait: 10_000, timeout: 30_000 });

  return { kind: removal.kind, removedRole: removal.removedRole, restoredCounts };
}
