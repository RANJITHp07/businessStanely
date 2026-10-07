export const sanitizeInactiveAgentEmail = (email?: string | null): string => {
  if (!email) return "";

  // Hide archival suffix used when inactive agents release their original email.
  return email.replace(/\+inactive-[^@]+(?=@)/i, "");
};

/**
 * Releases an agent's email when the agent is deleted, so the address can be
 * used for a new account. `sanitizeInactiveAgentEmail` reverses it for display
 * and for restore.
 */
export const buildArchivedAgentEmail = (email: string, agentId: string): string => {
  const normalized = email.toLowerCase();
  const [localPart, domainPart] = normalized.split("@");
  const suffix = `inactive-${agentId.slice(-6)}-${Date.now()}`;

  if (localPart && domainPart) {
    return `${localPart}+${suffix}@${domainPart}`;
  }

  return `${normalized}.${suffix}`;
};
