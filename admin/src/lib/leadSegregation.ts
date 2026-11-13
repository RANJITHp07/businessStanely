/**
 * Lead Segregation (To Be Contacted / Follow Up / Missed Out) covers only open
 * leads. Leads in any other status (Relevant but not Now, Career, Not Relevant)
 * are left out of its tables, counts and "View All" lists.
 */
export const LEAD_SEGREGATION_STATUSES = ["New", "In Progress"];

export function inLeadSegregation(status?: string | null) {
  return LEAD_SEGREGATION_STATUSES.includes(status ?? "");
}
