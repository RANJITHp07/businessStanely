import { useEffect, useState } from "react";

export interface AgentContext {
  id: string;
  name: string;
  email: string;
  agentType: string;
  agentRole: string;
}

export function useAgentContext(): AgentContext | null {
  const [agent, setAgent] = useState<AgentContext | null>(null);
  useEffect(() => {
    fetch("/api/agents/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.agentType) setAgent(data);
      });
  }, []);
  return agent;
}
