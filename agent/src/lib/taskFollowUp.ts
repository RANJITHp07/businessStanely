// The "Followups" group. It is not a task status: a task belongs
// to the group while it is In Progress on a 48hr/1w "Instance"
// (Task.followUpDuration), and its stored status stays In Progress. When the
// duration ends (Task.followUpUntil), its Instance returns to Working, which
// moves it back to In Progress; setting an Instance again restarts the wait.
//
// Keep this file identical in `agent/src/lib` and `admin/src/lib`.

export const FOLLOW_UP_GROUP = "Followups";

const HOUR_MS = 60 * 60 * 1000;
const FOLLOW_UP_WAIT_MS: Record<string, number> = {
  "48hr": 48 * HOUR_MS,
  "1w": 7 * 24 * HOUR_MS,
};
const FOLLOW_UP_DURATIONS = Object.keys(FOLLOW_UP_WAIT_MS);

const IN_PROGRESS_STATUSES = [
  "In Progress",
  "in progress",
  "inprogress",
  "Progress",
  "progress",
];

const normalize = (status?: string | null) =>
  (status || "").toLowerCase().replace(/\s+/g, "");

function isInProgressStatus(status?: string | null) {
  return ["inprogress", "progress"].includes(normalize(status));
}

type GroupableTask = {
  status?: string | null;
  followUpDuration?: string | null;
  active?: boolean | null;
};

/** Waiting (inactive) tasks join the group once the cron raises them. */
export function isFollowUpTask(task: GroupableTask) {
  return (
    task.active !== false &&
    FOLLOW_UP_DURATIONS.includes(task.followUpDuration || "") &&
    isInProgressStatus(task.status)
  );
}

/**
 * The end of the wait a task update must also write: when the task enters the
 * group, or its Instance changes while in the group. Empty otherwise, so an
 * update that resends the same values does not restart the wait.
 */
export function followUpTimer(
  current: GroupableTask,
  changes: GroupableTask,
  now = Date.now(),
): { followUpUntil?: Date } {
  const next = {
    status: changes.status ?? current.status,
    followUpDuration: changes.followUpDuration ?? current.followUpDuration,
    active: changes.active ?? current.active,
  };
  if (!isFollowUpTask(next)) return {};
  if (isFollowUpTask(current) && next.followUpDuration === current.followUpDuration) return {};
  return { followUpUntil: new Date(now + FOLLOW_UP_WAIT_MS[next.followUpDuration || ""]) };
}

/** The section a task is listed under: "followup", or its status bucket. */
export function taskSection(task: GroupableTask) {
  if (isFollowUpTask(task)) return "followup";
  const k = normalize(task.status);
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  return k || "todo";
}

const FOLLOW_UP_RULE = {
  active: true,
  followUpDuration: { in: FOLLOW_UP_DURATIONS },
};

/** Prisma filter for the tasks in the group; same rule as `isFollowUpTask`. */
export const FOLLOW_UP_WHERE = { ...FOLLOW_UP_RULE, status: { in: IN_PROGRESS_STATUSES } };

/** Prisma filter for In Progress tasks of the given spellings, outside the group. */
export function inProgressOutsideGroupWhere(statuses: string[]) {
  return {
    status: { in: statuses },
    // Spelled out instead of `NOT: FOLLOW_UP_RULE`: on MongoDB that also drops
    // tasks whose followUpDuration is null or unset, which are not in the group.
    OR: [
      { active: false },
      { followUpDuration: null },
      { followUpDuration: { isSet: false } },
      { followUpDuration: { notIn: FOLLOW_UP_DURATIONS } },
    ],
  };
}

/**
 * Prisma filter for one value of a list's status filter, so a section and its
 * "View more" list hold the same rows. "In Progress" leaves out the group,
 * unless the list also picks Instance durations: then it means the real status,
 * or In Progress + 48hr would match nothing.
 */
export function statusFilterWhere(value: string, durationFiltered = false) {
  if (normalize(value) === normalize(FOLLOW_UP_GROUP)) return FOLLOW_UP_WHERE;
  return isInProgressStatus(value) && !durationFiltered
    ? inProgressOutsideGroupWhere([value])
    : { status: value };
}
