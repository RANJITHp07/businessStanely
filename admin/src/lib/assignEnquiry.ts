import prisma from "@/lib/prisma";
import { ADVISOR_AGENT_ROLE, EXECUTION_AND_ADVISOR_AGENT_ROLE } from "@/lib/agentRole";

/**
 * Picks the Advisor Agent an accepted website enquiry goes to when the admin
 * chooses "Assign automatically" on Accept.
 *
 * Website enquiries arrive unassigned; nothing is routed until an admin has
 * checked the request. This is the same round-robin the leads queue uses,
 * pointed at agents opted in with enquiryAutoAssign (the "Set Enquiries per
 * Agent" dialog) rather than autoAssign.
 *
 * Eligibility is: an Advisor Agent, active, with enquiryAutoAssign set.
 * Ordering is by createdAt so the rotation is stable across calls. Position in
 * the rotation is worked out from the most recently assigned enquiries, so
 * there is no cursor to keep in sync.
 *
 * Returns null when nobody is eligible; the caller tells the admin to pick an
 * agent by hand.
 */
export async function pickEnquiryAssignee(): Promise<string | null> {
  const eligible = await prisma.agent.findMany({
    where: {
      status: "active",
      enquiryAutoAssign: true,
      agentRole: { in: [ADVISOR_AGENT_ROLE, EXECUTION_AND_ADVISOR_AGENT_ROLE] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!eligible.length) return null;

  const eligibleIds = eligible.map((a) => a.id);

  const setting = await prisma.prospectAssignmentSetting.findFirst({
    select: { enquiriesPerAgent: true },
  });
  /* A zero or negative quota would make the "has this agent had their share"
     test below always true and wedge everything on one agent, so floor it. */
  const perAgent = Math.max(1, setting?.enquiriesPerAgent ?? 1);

  /* Assignment now happens at accept time, not submission, so the rotation
     follows assignedAt. Only rows held by a currently-eligible agent count: an
     agent who has since been unticked must not hold the rotation's place. */
  const recent = await prisma.enquiry.findMany({
    where: { assignedAgentId: { in: eligibleIds }, assignedAt: { not: null } },
    orderBy: { assignedAt: "desc" },
    take: perAgent,
    select: { assignedAgentId: true },
  });

  const lastAgentId = recent[0]?.assignedAgentId;
  if (!lastAgentId) return eligibleIds[0];

  /* How many of the most recent assignments in a row went to that same agent.
     Once that reaches the quota, the rotation moves on. */
  let streak = 0;
  for (const row of recent) {
    if (row.assignedAgentId !== lastAgentId) break;
    streak++;
  }

  if (streak < perAgent) return lastAgentId;

  const lastIndex = eligibleIds.indexOf(lastAgentId);
  return eligibleIds[(lastIndex + 1) % eligibleIds.length];
}
