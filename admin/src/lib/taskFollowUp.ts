// Rules tying the "Instance" dropdown (Task.followUpDuration) to
// the StatusCheck & Followup status.
//
// Keep this file identical in `agent/src/lib` and `admin/src/lib`.

export const FOLLOW_UP_STATUS = "StatusCheck & Followup";

const FOLLOW_UP_DURATIONS = ["48hr", "1w"];

const normalize = (status?: string | null) =>
  (status || "").toLowerCase().replace(/\s+/g, "");

export function isFollowUpStatus(status?: string | null) {
  return normalize(status) === normalize(FOLLOW_UP_STATUS);
}

export function isFollowUpDuration(duration?: string | null) {
  return FOLLOW_UP_DURATIONS.includes(duration || "");
}

/** Only open work moves automatically: Hold, Completed and Abandoned are deliberate. */
function isOpenStatus(status?: string | null) {
  return ["todo", "pending", "inprogress", "progress"].includes(normalize(status));
}

/**
 * The status a task starts a period in. A task already on a 48hr/1w follow-up
 * goes straight to the follow-up status instead of To Do.
 */
export function initialTaskStatus(duration?: string | null) {
  return isFollowUpDuration(duration) ? FOLLOW_UP_STATUS : "To Do";
}

/**
 * Fields a task update must also write so the status and the follow-up
 * duration stay in step. Waiting (inactive) tasks are left alone: they get
 * their status when the cron raises them.
 *
 * - Duration changed to 48hr/1w: an open task moves to the follow-up status.
 * - Duration changed to anything else: a follow-up task returns to In Progress.
 * - Status changed from follow-up back to open work: the duration resets.
 */
export function followUpUpdates(
  current: {
    status?: string | null;
    followUpDuration?: string | null;
    active?: boolean | null;
  },
  body: {
    status?: string;
    followUpDuration?: string;
    active?: boolean;
  },
): { status?: string; followUpDuration?: string } {
  const active = body.active ?? current.active;
  if (active === false) return {};

  const status = body.status ?? current.status;
  const durationChanged =
    body.followUpDuration !== undefined &&
    body.followUpDuration !== current.followUpDuration;

  if (durationChanged) {
    if (isFollowUpDuration(body.followUpDuration)) {
      return isOpenStatus(status) ? { status: FOLLOW_UP_STATUS } : {};
    }
    return isFollowUpStatus(status) ? { status: "In Progress" } : {};
  }

  if (
    body.status !== undefined &&
    isFollowUpStatus(current.status) &&
    isOpenStatus(body.status) &&
    isFollowUpDuration(current.followUpDuration)
  ) {
    return { followUpDuration: "Working" };
  }

  return {};
}
