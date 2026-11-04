// Shared status bucketing for the My Tasks summary endpoint.
//
// Task.status is free-form text that has drifted over time ("To Do", "todo",
// "Pending", "In Progress", "progress", ...), so each dashboard section maps to
// every spelling we've seen rather than a single value. This mirrors the
// `statusKey` helper the My Tasks page used to apply client-side.

import { isFollowUpTask } from "@/lib/taskFollowUp";

export const SUMMARY_STATUS_SECTIONS = [
  { key: "todo", statuses: ["To Do", "to do", "todo", "Pending", "pending"] },
  {
    key: "inprogress",
    statuses: ["In Progress", "in progress", "inprogress", "Progress", "progress"],
  },
  { key: "completed", statuses: ["Completed", "completed"] },
  { key: "hold", statuses: ["Hold", "hold"] },
  { key: "followup", statuses: [] },
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

/** The columns needed to place a task in a section and tally it. */
export const SUMMARY_ROW_SELECT = {
  id: true,
  status: true,
  followUpDuration: true,
  active: true,
  dueDate: true,
} as const;

type SummaryRow = {
  id: string;
  status: string | null;
  followUpDuration?: string | null;
  active?: boolean | null;
  dueDate?: Date | null;
};

const SECTION_BY_STATUS = new Map<string, SummarySectionKey>(
  SUMMARY_STATUS_SECTIONS.flatMap(({ key, statuses }) =>
    (statuses as readonly string[]).map((status) => [status, key] as const),
  ),
);

/**
 * Works out the whole summary from one lightweight scan, so the endpoint does
 * not run a separate query per section. `rows` must be sorted newest first:
 * the first `limit` rows of each section are the ones it lists.
 */
export function summarizeTaskRows(rows: SummaryRow[], limit: number) {
  const statusTallies = new Map<string | null, number>();
  const sectionCounts = Object.fromEntries(
    SUMMARY_STATUS_SECTIONS.map(({ key }) => [key, 0]),
  ) as Record<SummarySectionKey, number>;
  const sectionById = new Map<string, SummarySectionKey>();
  const now = new Date();
  let overdue = 0;

  for (const row of rows) {
    if (row.dueDate && row.dueDate < now && statusKey(row.status) !== "completed") overdue += 1;
    statusTallies.set(row.status, (statusTallies.get(row.status) ?? 0) + 1);

    let key = SECTION_BY_STATUS.get(row.status ?? "");
    if (!key) continue;
    if (key === "inprogress" && isFollowUpTask(row)) key = "followup";

    sectionCounts[key] += 1;
    if (sectionCounts[key] <= limit) sectionById.set(row.id, key);
  }

  return {
    counts: buildStatusCounts(
      Array.from(statusTallies, ([status, n]) => ({ status, _count: { _all: n } })),
    ),
    sectionCounts,
    sectionById,
    overdue,
  };
}
