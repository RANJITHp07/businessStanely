// Shared shapes for the opportunity summary endpoint.
//
// The My Opportunities dashboard shows one table per status. These are the
// statuses it renders; anything else still counts toward `total`.
export const OPPORTUNITY_SUMMARY_STATUSES = [
  "New Opportunity",
  "Proposal Issued",
  "Closed as Won",
  "Closed as Loss",
] as const;

// Only the columns the summary tables actually render. Notably this drops
// `comments`, which the full listing loads for every opportunity.
export const OPPORTUNITY_SUMMARY_INCLUDE = {
  prospect: {
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      dialCode: true,
      assignedAgentId: true,
      createdByAgentId: true,
      assignedAgent: { select: { id: true, name: true } },
    },
  },
} as const;

export interface OpportunityCounts {
  total: number;
  proposal: number;
  won: number;
  loss: number;
  /** Summed `amount` across every opportunity in scope. */
  totalAmount: number;
  /** Summed `amount` across "Closed as Won" only. */
  wonAmount: number;
}

export function buildOpportunityCounts(
  groups: {
    status: string | null;
    _count: { _all: number };
    _sum: { amount: number | null };
  }[],
): OpportunityCounts {
  const counts: OpportunityCounts = {
    total: 0,
    proposal: 0,
    won: 0,
    loss: 0,
    totalAmount: 0,
    wonAmount: 0,
  };

  for (const group of groups) {
    const n = group._count._all;
    const amount = group._sum.amount ?? 0;

    counts.total += n;
    counts.totalAmount += amount;

    if (group.status === "Proposal Issued") counts.proposal += n;
    else if (group.status === "Closed as Won") {
      counts.won += n;
      counts.wonAmount += amount;
    } else if (group.status === "Closed as Loss") counts.loss += n;
  }

  return counts;
}
