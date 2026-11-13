import prisma from "@/lib/prisma";

/**
 * Checks the Lead Maker routing fields sent by the agent form: which Client
 * Advisors the Lead Maker's leads go to, and how many each takes in a row.
 * The agent app's lead rotation (agent/src/lib/assignLead.ts) reads them.
 *
 * Returns the values to write, `{}` to leave them as they are (the request
 * did not send them, or the agent is not a Lead Maker), or an error message.
 */
export async function cleanLeadRouting(
  body: { clientAdvisorIds?: unknown; leadsPerAdvisor?: unknown },
  isLeadMaker: boolean,
): Promise<
  | { ok: true; data: { clientAdvisorIds?: string[]; leadsPerAdvisor?: number | null } }
  | { ok: false; error: string }
> {
  if (!isLeadMaker) return { ok: true, data: {} };
  const data: { clientAdvisorIds?: string[]; leadsPerAdvisor?: number | null } = {};

  if (body.clientAdvisorIds !== undefined) {
    if (
      !Array.isArray(body.clientAdvisorIds) ||
      !body.clientAdvisorIds.every((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))
    ) {
      return { ok: false, error: "Client advisors must be a list of agent IDs." };
    }
    const ids = [...new Set(body.clientAdvisorIds as string[])];
    if (ids.length) {
      const found = await prisma.agent.count({
        where: {
          id: { in: ids },
          OR: [{ agentType: "Client Advisor" }, { advisorAgentType: "Client Advisor" }],
        },
      });
      if (found !== ids.length) {
        return { ok: false, error: "Only Client Advisors can receive a Lead Maker's leads." };
      }
    }
    data.clientAdvisorIds = ids;
  }

  if (body.leadsPerAdvisor !== undefined) {
    if (body.leadsPerAdvisor === null || body.leadsPerAdvisor === "") {
      data.leadsPerAdvisor = null;
    } else {
      const n = Number(body.leadsPerAdvisor);
      if (!Number.isInteger(n) || n < 1) {
        return { ok: false, error: "Leads per advisor must be a whole number of 1 or more." };
      }
      data.leadsPerAdvisor = n;
    }
  }

  return { ok: true, data };
}
