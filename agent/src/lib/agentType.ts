const ADVISOR_AGENT_TYPES = [
  "Lead Maker",
  "Client Advisor",
  "Client Manager",
] as const;
const EXECUTION_AGENT_TYPES = [
  "Owner",
  "Partner",
  "CEO",
  "Senior Manager",
  "Manager",
  "Senior Executive",
  "Executive",
  "Junior Executive",
  "Trainee",
  "Intern",
] as const;

type AgentTypeCarrier = {
  agentType?: string | null;
  executionAgentType?: string | null;
  advisorAgentType?: string | null;
};

export function getExecutionAgentType(
  agent?: AgentTypeCarrier | null,
): string | null {
  if (!agent) return null;
  if (agent.executionAgentType) return agent.executionAgentType;
  return EXECUTION_AGENT_TYPES.includes(
    (agent.agentType || "") as (typeof EXECUTION_AGENT_TYPES)[number],
  )
    ? (agent.agentType as string)
    : null;
}

export function getAdvisorAgentType(
  agent?: AgentTypeCarrier | null,
): string | null {
  if (!agent) return null;
  if (agent.advisorAgentType) return agent.advisorAgentType;
  return ADVISOR_AGENT_TYPES.includes(
    (agent.agentType || "") as (typeof ADVISOR_AGENT_TYPES)[number],
  )
    ? (agent.agentType as string)
    : null;
}

export function isLeadMaker(agent?: AgentTypeCarrier | null): boolean {
  return getAdvisorAgentType(agent) === "Lead Maker";
}

export function isClientAdvisorOrManager(
  agent?: AgentTypeCarrier | null,
): boolean {
  const advisorType = getAdvisorAgentType(agent);
  return advisorType === "Client Advisor" || advisorType === "Client Manager";
}

export function isClientManager(agent?: AgentTypeCarrier | null): boolean {
  return getAdvisorAgentType(agent) === "Client Manager";
}
