// Shared task-count predicates for legislation task badges.
//
// The agent and admin apps each render Total / Running / Overdue / Pending
// Trigger counts for the same legislation. Keep this file identical in
// `agent/src/lib` and `admin/src/lib` so the two can never disagree.

export type CountableTask = {
  active?: boolean | null;
  status?: string | null;
  dueDate?: string | Date | null;
};

/**
 * Normalizes the free-form `status` string. The column is a plain String in
 * Prisma, so casing and spacing vary across rows ("To Do", "todo", "In
 * Progress", "inprogress"). Never compare `status` literally.
 */
export function statusKey(s?: string | null) {
  const k = (s || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  if (["hold"].includes(k)) return "hold";
  return k || "todo";
}

/** A task that is neither finished nor parked. */
function isOpen(task: CountableTask) {
  const key = statusKey(task.status);
  return key !== "completed" && key !== "hold";
}

/** Live work: activated and still open. */
export function countRunning(tasks?: CountableTask[] | null) {
  return (tasks || []).filter((t) => t.active && isOpen(t)).length;
}

/** Running work whose due date has passed. */
export function countOverdue(tasks?: CountableTask[] | null) {
  const now = Date.now();
  return (tasks || []).filter(
    (t) => t.active && isOpen(t) && t.dueDate && new Date(t.dueDate).getTime() < now,
  ).length;
}

/** Open work that has not been activated yet — awaiting its trigger date. */
export function countPendingTriggers(tasks?: CountableTask[] | null) {
  return (tasks || []).filter((t) => !t.active && isOpen(t)).length;
}
