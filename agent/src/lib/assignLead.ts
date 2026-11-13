import prisma from "@/lib/prisma";

/**
 * Picks the Client Advisor a new lead goes to when the creator did not pick one.
 *
 * A Lead Maker with chosen advisors (Agent.clientAdvisorIds) sends leads only to
 * them, rotating every Agent.leadsPerAdvisor leads (or the global setting when
 * unset). Those advisors are reserved: the global rotation leaves them out, so
 * they only get leads from their own Lead Makers.
 *
 * If none of a Lead Maker's advisors is active with autoAssign on, the lead uses
 * the global rotation instead. If the global rotation has nobody outside the
 * reserved advisors, it falls back to them, so a lead is never rejected.
 *
 * Returns null when nobody is eligible.
 */
export async function pickLeadAssignee(leadMakerId: string): Promise<string | null> {
  const [setting, leadMaker] = await Promise.all([
    prisma.prospectAssignmentSetting.findFirst({ select: { prospectsPerAgent: true } }),
    prisma.agent.findUnique({
      where: { id: leadMakerId },
      select: { clientAdvisorIds: true, leadsPerAdvisor: true },
    }),
  ]);
  const globalPerAgent = Math.max(1, setting?.prospectsPerAgent ?? 1);

  if (leadMaker?.clientAdvisorIds?.length) {
    const chosen = await eligibleAdvisors({ id: { in: leadMaker.clientAdvisorIds } });
    if (chosen.length) {
      return nextInRotation(chosen, Math.max(1, leadMaker.leadsPerAdvisor ?? globalPerAgent));
    }
  }

  const reserved = await reservedAdvisorIds();
  const pool = await eligibleAdvisors({
    agentType: "Client Advisor",
    ...(reserved.length ? { id: { notIn: reserved } } : {}),
  });
  if (pool.length) return nextInRotation(pool, globalPerAgent);

  // Last resort: every available advisor is reserved by some Lead Maker. Use
  // them rather than reject the lead, which would lose it.
  const everyone = await eligibleAdvisors({ agentType: "Client Advisor" });
  if (!everyone.length) return null;
  return nextInRotation(everyone, globalPerAgent);
}

/** Active, auto-assign advisors matching `where`, in a stable order. */
async function eligibleAdvisors(where: Record<string, unknown>) {
  const agents = await prisma.agent.findMany({
    where: { ...where, status: "active", autoAssign: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}

/** Advisors chosen by any active Lead Maker; the global rotation skips them. */
async function reservedAdvisorIds() {
  const makers = await prisma.agent.findMany({
    where: {
      status: "active",
      OR: [{ agentType: "Lead Maker" }, { advisorAgentType: "Lead Maker" }],
    },
    select: { clientAdvisorIds: true },
  });
  return [...new Set(makers.flatMap((m) => m.clientAdvisorIds ?? []))];
}

/**
 * The advisor whose turn it is. The position comes from the latest leads held
 * by this pool, so there is no cursor to keep in sync: the last advisor keeps
 * the turn until they have had `perAgent` leads in a row.
 */
async function nextInRotation(pool: string[], perAgent: number) {
  const recent = await prisma.prospect.findMany({
    where: { assignedAgentId: { in: pool } },
    orderBy: { createdAt: "desc" },
    take: perAgent,
    select: { assignedAgentId: true },
  });

  const last = recent[0]?.assignedAgentId;
  if (!last) return pool[0];

  let streak = 0;
  for (const row of recent) {
    if (row.assignedAgentId !== last) break;
    streak++;
  }
  if (streak < perAgent) return last;

  return pool[(pool.indexOf(last) + 1) % pool.length];
}
