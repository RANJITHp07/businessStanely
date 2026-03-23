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
