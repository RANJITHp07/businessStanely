/**
 * Pure scheduling rules for recurring tasks: no database, no Node-only
 * imports, so the task forms can compute the same deadlines the cron writes.
 * The cron in singleTaskRecurring.ts imports everything from here; the agent
 * app keeps an identical copy, so keep the two in step.
 */

export const RECURRING_TYPES = ["once", "day", "week", "month", "year"] as const;
export type RecurringType = (typeof RECURRING_TYPES)[number];

export function isRecurringType(value: string): value is RecurringType {
  return (RECURRING_TYPES as readonly string[]).includes(value);
}

/**
 * Normalise a stored weekday set to sorted, unique ISO weekdays (1 = Monday ...
 * 7 = Sunday). Anything out of range is dropped rather than clamped: a bad
 * value is a data problem, and clamping would silently fire the task on a day
 * nobody picked.
 */
export function normalizeWeekDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days = value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

/**
 * ISO weekday of a date: 1 = Monday ... 7 = Sunday (JS Sunday 0 becomes 7).
 * Read in UTC because trigger dates are stored as UTC midnight of the picked
 * day; a local-time read on a non-UTC server lands on the day before.
 */
export function isoWeekDay(date: Date): number {
  return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
}

/**
 * The next occurrence strictly after `from` for a task that fires on specific
 * weekdays, e.g. every Monday and Wednesday.
 *
 * `weekInterval` spaces out the *weeks* the task runs in: 1 is every week, 2
 * fires on the chosen weekdays every other week. Weeks are counted from the
 * Monday of the anchor's week, so the rhythm stays fixed to the schedule's
 * origin instead of drifting each time the job rolls forward.
 */
export function nextWeekDayOccurrence(
  from: Date,
  weekDays: number[],
  weekInterval: number,
  anchor: Date,
): Date {
  const mondayOf = (date: Date) => {
    const monday = new Date(date);
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - (isoWeekDay(monday) - 1));
    return monday;
  };

  const anchorMonday = mondayOf(anchor);
  const interval = weekInterval >= 1 ? weekInterval : 1;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const candidate = new Date(from);
  candidate.setUTCHours(0, 0, 0, 0);

  // Walk day by day. Bounded by interval * 7 + 7 days, so this terminates even
  // if `from` sits far from the anchor.
  for (let step = 1; step <= interval * 7 + 7; step++) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);

    if (!weekDays.includes(isoWeekDay(candidate))) continue;

    // Only accept weekdays that land in an "on" week for this interval.
    const weeksFromAnchor = Math.round(
      (mondayOf(candidate).getTime() - anchorMonday.getTime()) / msPerWeek,
    );
    if (((weeksFromAnchor % interval) + interval) % interval !== 0) continue;

    return candidate;
  }

  // Unreachable for a non-empty weekDays set; falls back to the plain interval.
  const fallback = new Date(from);
  fallback.setUTCDate(fallback.getUTCDate() + interval * 7);
  return fallback;
}

/**
 * Days spanned by one interval of a recurrence, or null when it has no fixed
 * span. Used to bound a service window that would otherwise outlast the
 * interval and let occurrences overlap.
 *
 * A weekday set has no single span (Mon+Wed is 2 days then 5), so the caller
 * computes its real next occurrence instead of using an approximation. Month
 * and year are approximated only for comparison, never for a stored date.
 */
export function intervalSpanDays(
  recurringType: RecurringType,
  recurringValue: number,
  weekDays: number[],
): number | null {
  if (weekDays.length > 0) return null;
  if (recurringType === "day") return recurringValue;
  if (recurringType === "week") return recurringValue * 7;
  if (recurringType === "month") return recurringValue * 28;
  if (recurringType === "year") return recurringValue * 365;
  return null;
}

/**
 * The deadline for an occurrence starting on `start`.
 *
 * The service (task category) grants `timePeriod` days, but a repeating task
 * must also close before its next occurrence opens. When the service window is
 * the longer of the two the periods overlap -- a task repeating every 1 day
 * with a 5-day service was given a deadline 5 days out, so four later
 * occurrences opened while the first was still pending, each resetting status
 * and progress on the same row. The shorter bound wins.
 *
 * `spanDays` is null for a one-off (no successor) or a weekday set (no single
 * span), and the full service window then applies.
 */
export function occurrenceDeadline(
  start: Date,
  timePeriodDays: number | null | undefined,
  spanDays: number | null,
): Date {
  const deadline = new Date(start);
  if (timePeriodDays) {
    deadline.setUTCDate(deadline.getUTCDate() + Number(timePeriodDays));
  }

  if (spanDays !== null && spanDays >= 1) {
    // One day before the next occurrence opens, so the two never share a day.
    // At a 1-day interval this collapses onto the start date itself: a daily
    // task is due the day it is raised.
    const bounded = new Date(start);
    bounded.setUTCDate(bounded.getUTCDate() + spanDays - 1);
    if (bounded < deadline) return bounded;
  }

  return deadline;
}

/**
 * The deadline for one occurrence of a schedule starting on `start`: the
 * service's `timePeriod` days, cut short so the occurrence closes the day
 * before the next one opens. A task repeating every day with a 5-day service
 * is due the day it is raised; every 3 weeks with the same service keeps the
 * full 5 days. A weekday set (e.g. Mon + Wed) is bounded by its real next
 * occurrence, anchored on the week `start` falls in, as a new schedule is.
 *
 * `start` must be UTC midnight of the calendar day, as trigger dates are
 * stored. A one-off or an unreadable schedule gets the full service window.
 */
export function scheduleDeadline(
  start: Date,
  timePeriodDays: number | null | undefined,
  recurringType: string | null | undefined,
  recurring: number | string | null | undefined,
  recurringWeekDays?: unknown,
): Date {
  const type =
    typeof recurringType === "string" ? recurringType.toLowerCase() : "";
  const interval = Number(recurring);
  if (
    !isRecurringType(type) ||
    type === "once" ||
    !Number.isInteger(interval) ||
    interval < 1
  ) {
    return occurrenceDeadline(start, timePeriodDays, null);
  }

  const weekDays = type === "week" ? normalizeWeekDays(recurringWeekDays) : [];
  if (weekDays.length === 0) {
    return occurrenceDeadline(
      start,
      timePeriodDays,
      intervalSpanDays(type, interval, []),
    );
  }

  const dayBefore = nextWeekDayOccurrence(start, weekDays, interval, start);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const serviceDeadline = occurrenceDeadline(start, timePeriodDays, null);
  if (dayBefore < serviceDeadline) {
    return dayBefore < start ? new Date(start) : dayBefore;
  }
  return serviceDeadline;
}
