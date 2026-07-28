// Shared shapes for the prospect (lead) summary endpoint.
//
// The My Leads dashboard shows one table per status. These are the statuses it
// renders; anything else still counts toward `total` but has no section.
export const PROSPECT_SUMMARY_STATUSES = [
  "New",
  "In Progress",
  "Relevant but not Now",
  "Career",
  "Not Relevant",
] as const;

// Only the columns the summary tables actually render. Notably this drops
// `comments`, which the full listing loads for every prospect.
export const PROSPECT_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  dialCode: true,
  description: true,
  status: true,
  nextFollowUp: true,
  archived: true,
  createdAt: true,
  assignedAgent: { select: { id: true, name: true } },
} as const;

export interface ProspectCounts {
  total: number;
  new: number;
  inProgress: number;
}

export function buildProspectCounts(
  groups: { status: string | null; _count: { _all: number } }[],
): ProspectCounts {
  const counts: ProspectCounts = { total: 0, new: 0, inProgress: 0 };

  for (const group of groups) {
    const n = group._count._all;
    counts.total += n;
    if (group.status === "New") counts.new += n;
    else if (group.status === "In Progress") counts.inProgress += n;
  }

  return counts;
}
