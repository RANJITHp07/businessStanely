// Shared status bucketing for the My Tasks summary endpoint.
//
// Task.status is free-form text that has drifted over time ("To Do", "todo",
// "Pending", "In Progress", "progress", ...), so each dashboard section maps to
// every spelling we've seen rather than a single value. This mirrors the
// `statusKey` helper the My Tasks page used to apply client-side.

export const SUMMARY_STATUS_SECTIONS = [
  { key: "todo", statuses: ["To Do", "to do", "todo", "Pending", "pending"] },
  {
    key: "inprogress",
    statuses: ["In Progress", "in progress", "inprogress", "Progress", "progress"],
  },
  { key: "completed", statuses: ["Completed", "completed"] },
  { key: "hold", statuses: ["Hold", "hold"] },
] as const;

export type SummarySectionKey = (typeof SUMMARY_STATUS_SECTIONS)[number]["key"];

export function statusKey(status?: string | null): SummarySectionKey | string {
  const k = (status || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  return k || "todo";
}

export interface StatusCounts {
  total: number;
  /** Everything that isn't completed or in-progress — including Hold and any
   *  unrecognised status. This is what the "Pending" stat card shows, and it
   *  matches the old client-side tally exactly. */
  todo: number;
  inprogress: number;
  completed: number;
  /** Subset of `todo`, broken out for the Hold section header. */
  hold: number;
}

/**
 * Collapse a Prisma `groupBy(["status"])` result into the dashboard buckets.
 * Statuses outside the known set fall into `todo`, matching the old
 * client-side behaviour where `statusKey` defaulted unknown values that way.
 */
export function buildStatusCounts(
  groups: { status: string | null; _count: { _all: number } }[],
): StatusCounts {
  const counts: StatusCounts = {
    total: 0,
    todo: 0,
    inprogress: 0,
    completed: 0,
    hold: 0,
  };

  for (const group of groups) {
    const n = group._count._all;
    counts.total += n;

    const key = statusKey(group.status);
    if (key === "completed") counts.completed += n;
    else if (key === "inprogress") counts.inprogress += n;
    else {
      counts.todo += n;
      if (key === "hold") counts.hold += n;
    }
  }

  return counts;
}
