export type AgentRole =
  | "Execution Agent"
  | "Advisor Agent"
  | "Execution & Advisor Agent";

export const EXECUTION_AGENT_ROLE: AgentRole = "Execution Agent";
export const ADVISOR_AGENT_ROLE: AgentRole = "Advisor Agent";
export const EXECUTION_AND_ADVISOR_AGENT_ROLE: AgentRole =
  "Execution & Advisor Agent";

export function hasExecutionRole(role?: string | null): boolean {
  return (
    role === EXECUTION_AGENT_ROLE || role === EXECUTION_AND_ADVISOR_AGENT_ROLE
  );
}

export function hasAdvisorRole(role?: string | null): boolean {
  return (
    role === ADVISOR_AGENT_ROLE || role === EXECUTION_AND_ADVISOR_AGENT_ROLE
  );
}

/**
 * The advisor sub-type ("Lead Maker" | "Client Advisor" | "Client Manager").
 * A dual-role agent keeps its execution type in agentType, so its advisor type
 * lives in advisorAgentType; a pure advisor may have it in either field.
 */
export function getAdvisorType(agent: {
  agentRole?: string | null;
  agentType?: string | null;
  advisorAgentType?: string | null;
}): string | null {
  if (agent.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE) {
    return agent.advisorAgentType || agent.agentType || null;
  }
  return agent.agentType || agent.advisorAgentType || null;
}

/**
 * Whether leads and opportunities can be assigned to this agent: an active
 * advisor that is not a Lead Maker. Lead Makers only originate leads; matching
 * the Create Lead form, they are never the assigned owner.
 */
export function canOwnLeads(agent: {
  status?: string | null;
  agentRole?: string | null;
  agentType?: string | null;
  advisorAgentType?: string | null;
}): boolean {
  return (
    agent.status?.trim().toLowerCase() !== "inactive" &&
    hasAdvisorRole(agent.agentRole) &&
    getAdvisorType(agent) !== "Lead Maker"
  );
}
