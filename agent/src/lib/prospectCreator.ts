/** Lead source every lead made from a businessPlus website enquiry carries. */
export const BUSINESS_PLUS_LEAD_SOURCE = "BusinessPlus";

type ProspectLike = {
  createdByAgent?: { name?: string | null } | null;
  /* Typed loosely: some pages declare it as a string, though the API sends
     the related LeadSource object. */
  leadSource?: unknown;
} | null | undefined;

/**
 * Who a lead is shown as created by. Leads accepted from a businessPlus
 * enquiry have no creating agent (an admin accepted a website request), so
 * they read as coming from the website rather than "Unknown".
 */
export function prospectCreatorName(prospect: ProspectLike): string {
  if (prospect?.createdByAgent?.name) return prospect.createdByAgent.name;
  const source = prospect?.leadSource as { name?: unknown } | string | null | undefined;
  const sourceName = typeof source === "string" ? source : source?.name;
  if (sourceName === BUSINESS_PLUS_LEAD_SOURCE) return "BusinessPlus website";
  return "Unknown";
}
