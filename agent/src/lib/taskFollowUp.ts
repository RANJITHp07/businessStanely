// The "Followups" group. It is not a task status: a task belongs
// to the group while it is In Progress on a 48hr/1w "Instance"
// (Task.followUpDuration), and its stored status stays In Progress. The Instance
// only changes when someone changes it. Task.followUpUntil is the first day the
// task needs a day track; it then needs one every 48hr/1w after that, whether or
// not the earlier one was written. Setting an Instance again restarts the cycle.
//
// Keep this file identical in `agent/src/lib` and `admin/src/lib`.

import { istDateKey } from "./dailyTrack";

export const FOLLOW_UP_GROUP = "Followups";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
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
  followUpUntil?: Date | string | null;
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
 * Whether a task needs a day track on the IST day `dateKey`. Tasks outside the
 * group need one every day; tasks in it only on their cycle's days. A group task
 * with no followUpUntil has no known cycle, so it stays in the day tracker rather
 * than silently never needing a note.
 */
export function needsDayTrackOn(task: GroupableTask, dateKey = istDateKey()) {
  if (!isFollowUpTask(task) || !task.followUpUntil) return true;
  const firstDay = istDateKey(new Date(task.followUpUntil));
  const days = (Date.parse(dateKey) - Date.parse(firstDay)) / DAY_MS;
  const cycleDays = FOLLOW_UP_WAIT_MS[task.followUpDuration || ""] / DAY_MS;
  return days >= 0 && days % cycleDays === 0;
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
