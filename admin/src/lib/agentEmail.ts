export const sanitizeInactiveAgentEmail = (email?: string | null): string => {
  if (!email) return "";

  // Hide archival suffix used when inactive agents release their original email.
  return email.replace(/\+inactive-[^@]+(?=@)/i, "");
};
