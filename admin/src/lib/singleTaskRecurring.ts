import prisma from "@/lib/prisma";
import { createTransporter } from "./email";
import { format } from "date-fns";

const RECURRING_TYPES = ["once", "day", "week", "month", "year"] as const;
type RecurringType = (typeof RECURRING_TYPES)[number];

function isRecurringType(value: string): value is RecurringType {
  return (RECURRING_TYPES as readonly string[]).includes(value);
}

/**
 * Normalise a stored weekday set to sorted, unique ISO weekdays (1 = Monday ...
 * 7 = Sunday). Anything out of range is dropped rather than clamped: a bad
 * value is a data problem, and clamping would silently fire the task on a day
 * nobody picked.
 */
function normalizeWeekDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days = value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

/** ISO weekday of a date: 1 = Monday ... 7 = Sunday (JS Sunday 0 becomes 7). */
function isoWeekDay(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
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
function nextWeekDayOccurrence(
  from: Date,
  weekDays: number[],
  weekInterval: number,
  anchor: Date,
): Date {
  const mondayOf = (date: Date) => {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (isoWeekDay(monday) - 1));
    return monday;
  };

  const anchorMonday = mondayOf(anchor);
  const interval = weekInterval >= 1 ? weekInterval : 1;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const candidate = new Date(from);
  candidate.setHours(0, 0, 0, 0);

  // Walk day by day. Bounded by interval * 7 + 7 days, so this terminates even
  // if `from` sits far from the anchor.
  for (let step = 1; step <= interval * 7 + 7; step++) {
    candidate.setDate(candidate.getDate() + 1);

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
  fallback.setDate(fallback.getDate() + interval * 7);
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
function intervalSpanDays(
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
    deadline.setDate(deadline.getDate() + Number(timePeriodDays));
  }

  if (spanDays !== null && spanDays >= 1) {
    // One day before the next occurrence opens, so the two never share a day.
    // At a 1-day interval this collapses onto the start date itself: a daily
    // task is due the day it is raised.
    const bounded = new Date(start);
    bounded.setDate(bounded.getDate() + spanDays - 1);
    if (bounded < deadline) return bounded;
  }

  return deadline;
}

// Auto-update recurring tasks based on calendar schedule (not completion)
export async function updateRecurringTaskSchedule(taskId: string) {
  const task: any = await prisma.task.findUnique({
    where: { id: taskId },
    include: { category: true },
  });

  if (!task || !task.recurring) return null;

  // The interval is two columns that must agree. Defaulting an unreadable
  // recurringType to "month" (as this used to) turns "every 2 days" into
  // "every 2 months" on any row whose type failed to save -- a silent 60x
  // stretch of the schedule. An unreadable pair is a data problem, so the
  // task is skipped and reported rather than advanced by a guessed interval.
  let recurringType: RecurringType | null = null;
  let recurringValue = typeof task.recurring === "number" ? task.recurring : NaN;

  if (typeof task.recurringType === "string" && task.recurringType) {
    const normalizedType = task.recurringType.toLowerCase();
    if (isRecurringType(normalizedType)) {
      recurringType = normalizedType;
    }
  }

  // Backward compatibility if recurring was previously stored as "type-value".
  if (typeof task.recurring === "string" && task.recurring.includes("-")) {
    const [type, value] = task.recurring.split("-");
    if (isRecurringType(type)) {
      recurringType = type;
    }
    recurringValue = parseInt(value, 10);
  }

  if (!recurringType) {
    console.warn(
      `⚠️ Task ${taskId} has recurring=${JSON.stringify(task.recurring)} but ` +
        `recurringType=${JSON.stringify(task.recurringType)}; skipping until the pair is fixed.`,
    );
    return null;
  }

  if (!Number.isFinite(recurringValue) || recurringValue < 1) {
    console.warn(
      `⚠️ Task ${taskId} has a non-positive recurring interval ` +
        `(${JSON.stringify(task.recurring)}); skipping.`,
    );
    return null;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const triggerDate = new Date(task.triggerDate || task.dueDate);
  if (isNaN(triggerDate.getTime())) return null;
  // Process anything due today or earlier (not just an exact match on "today"),
  // so a missed cron run doesn't permanently skip the task.
  if (triggerDate > endOfToday) return null;

  // A weekday set has no single span, so its bound comes from the real next
  // occurrence (computed below) rather than an interval approximation.
  const weekDaysForSpan =
    recurringType === "week" ? normalizeWeekDays(task.recurringWeekDays) : [];
  const spanDays = intervalSpanDays(
    recurringType,
    recurringValue,
    weekDaysForSpan,
  );

  const deadlineFor = (start: Date, nextStart?: Date) => {
    // For a weekday schedule the bound is the day before the actual next
    // occurrence; for everything else it is the interval span.
    if (nextStart) {
      const dayBefore = new Date(nextStart);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const serviceDeadline = occurrenceDeadline(
        start,
        task.category?.timePeriod,
        null,
      );
      if (dayBefore < serviceDeadline) {
        return dayBefore < start ? new Date(start) : dayBefore;
      }
      return serviceDeadline;
    }
    return occurrenceDeadline(start, task.category?.timePeriod, spanDays);
  };

  if (recurringType === "once") {
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        triggerDate: null,
        // A one-off has no successor to collide with, so it keeps the full
        // service window regardless of the interval it was created with.
        dueDate: occurrenceDeadline(triggerDate, task.category?.timePeriod, null),
        nextDueDate: null,
        currentPeriodStart: triggerDate,
        completed: false,
        progress: 0,
        status: "To Do",
        active: true,
        recurring: null,
        recurringType: null,
      },
    });

    return updatedTask;
  }

  // A WEEK task may pin itself to specific weekdays (e.g. Monday and
  // Wednesday). The weekday set overrides the plain "+N weeks" hop, since the
  // interval alone can only ever produce one occurrence per cycle and would
  // drift onto whatever weekday the trigger date happened to start on.
  const weekDays =
    recurringType === "week" ? normalizeWeekDays(task.recurringWeekDays) : [];

  // `currentPeriodStart` is the schedule's origin, so an every-other-week
  // rhythm stays fixed to the week it started in rather than re-basing (and
  // slipping a week) on each roll-forward. Falls back to the trigger date for
  // rows created before this field was populated.
  const weekAnchor = new Date(task.currentPeriodStart || triggerDate);

  /** One hop forward from `from`, by whichever rule this schedule uses. */
  const advanceOnce = (from: Date): Date => {
    if (weekDays.length > 0) {
      return nextWeekDayOccurrence(
        from,
        weekDays,
        recurringValue,
        isNaN(weekAnchor.getTime()) ? triggerDate : weekAnchor,
      );
    }

    const next = new Date(from);
    if (recurringType === "day") {
      next.setDate(next.getDate() + recurringValue);
    } else if (recurringType === "week") {
      next.setDate(next.getDate() + recurringValue * 7);
    } else if (recurringType === "year") {
      // setFullYear keeps the month/day, except 29 Feb in a non-leap year,
      // which JS rolls into 1 March. Clamping back to 28 Feb keeps a task
      // seeded on a leap day inside February for every other year.
      const day = next.getDate();
      const month = next.getMonth();
      next.setFullYear(next.getFullYear() + recurringValue);
      if (next.getMonth() !== month || next.getDate() !== day) {
        next.setDate(0);
      }
    } else {
      next.setMonth(next.getMonth() + recurringValue);
    }
    return next;
  };

  // Advance repeatedly (not just once) so a task that's been dormant for
  // several missed periods lands on the next occurrence that is actually
  // upcoming, instead of one interval past a still-overdue triggerDate.
  let nextTriggerDate = new Date(triggerDate);
  do {
    nextTriggerDate = advanceOnce(nextTriggerDate);
  } while (nextTriggerDate <= endOfToday);

  // The occurrence after this one bounds the deadline: a period must close
  // before its successor opens.
  const followingTriggerDate = advanceOnce(nextTriggerDate);
  const nextDueDate = deadlineFor(nextTriggerDate, followingTriggerDate);

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      triggerDate: nextTriggerDate,
      // The row now represents the occurrence starting on nextTriggerDate, so
      // its due date is that occurrence's deadline. Writing the *previous*
      // occurrence's deadline here (the old behaviour) left rows like
      // trigger=2026-07-09 alongside due=2026-01-29.
      dueDate: nextDueDate,
      nextDueDate,
      currentPeriodStart: nextTriggerDate,
      completed: false,
      progress: 0,
      status: "To Do",
      active: true,
    },
  });

  return updatedTask;
}

// Update due dates for tasks in "Hold" status
export async function updateHoldTasks() {
  // No dueDate filter: an undated task still has to come back off hold after
  // 10 days. Filtering on dueDate left such tasks stuck in Hold forever.
  const holdTasks = await prisma.task.findMany({
    where: { status: "Hold" },
  });

  const updatedTasks = [];

  for (const task of holdTasks) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Tasks held before holdDate was stamped unconditionally have none, so
      // the resume clock could never start. Start it now.
      if (!task.holdDate) {
        const stamped = await prisma.task.update({
          where: { id: task.id },
          data: { holdDate: new Date() },
        });
        updatedTasks.push(stamped);
        continue;
      }

      // Auto-resume: if task has been on hold for 10+ days, move to "To Do" (New Tasks)
      if (task.holdDate) {
        const holdStart = new Date(task.holdDate);
        holdStart.setHours(0, 0, 0, 0);
        const daysOnHold = Math.floor(
          (today.getTime() - holdStart.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysOnHold >= 10) {
          const resumedTask = await prisma.task.update({
            where: { id: task.id },
            data: {
              status: "To Do",
              active:true,
              holdDate: null,
              holdDaysLeft: null,
            },
          });
          updatedTasks.push(resumedTask);
          console.log(
            `✅ Auto-resumed task ${task.id} after ${daysOnHold} days on hold.`,
          );
          continue;
        }
      }

      // A held task's deadline slips one day per day on hold, so the time it
      // had left when it was held is preserved rather than consumed.
      //
      // The overdue branch used to re-add the task's *original* span
      // (dueDate - createdAt) on top of today, so a task created 60 days
      // before its deadline jumped 60 days forward on every single hold run.
      // It also mixed a midnight-normalised `due` with a raw `createdAt`
      // timestamp, leaving the Math.ceil off by a fraction of a day. Both
      // branches now just add one day.
      if (task.dueDate) {
        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);

        const newDueDate = new Date(due < today ? today : due);
        newDueDate.setDate(newDueDate.getDate() + 1);

        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: { dueDate: newDueDate },
        });

        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating hold task ${task.id}:`, error);
    }
  }

  console.log(`📅 Auto-updated ${updatedTasks.length} tasks in "Hold" status.`);
  return updatedTasks;
}

// Extend updateAllRecurringTasks to include "Hold" tasks
export async function updateAllRecurringTasks() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // Find all active recurring tasks due today or earlier (catches tasks
  // whose triggerDate was missed on a day the cron didn't run).
  const recurringTasks = await prisma.task.findMany({
    where: {
      recurring: { not: null },
      recurringType: { not: null },
      triggerDate: {
        lt: startOfTomorrow,
      },
    },
  });

  const updatedTasks = [];

  for (const task of recurringTasks) {
    try {
      const updatedTask = await updateRecurringTaskSchedule(task.id);
      if (updatedTask) {
        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating recurring task ${task.id}:`, error);
    }
  }

  const holdTasks = await updateHoldTasks();
  updatedTasks.push(...holdTasks);

  console.log(
    `📅 Auto-updated ${updatedTasks.length} tasks (recurring + hold).`,
  );
  return updatedTasks;
}

/**
 * Seed the recurring/scheduling fields right after a task is created.
 *
 * `nextDueDate` is the deadline of the upcoming occurrence, and the rule is the
 * same one the cron uses when it rolls a task forward: the occurrence starts on
 * the trigger date and the service (task category) grants `timePeriod` days to
 * finish it. Computing it here from the stored triggerDate + timePeriod rather
 * than from the form's dueDate keeps the value correct from creation instead of
 * only after the first cron run — the create form derives its dueDate from
 * *today* + timePeriod and clears the trigger date when the category changes, so
 * the submitted dueDate is not the trigger-based deadline for retainership
 * tasks that are scheduled to start later.
 *
 * Falls back to the task's own dueDate when there is no trigger date (a one-off
 * task that starts immediately), and leaves the deadline at the trigger date
 * when the category carries no timePeriod.
 */
export async function initializeRecurringTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { category: { select: { timePeriod: true } } },
  });

  if (!task) return null;

  const periodStart = task.triggerDate ?? task.dueDate;
  if (!periodStart) return null;

  // The same bound the cron applies when it rolls the task forward: a
  // repeating occurrence cannot outlast its own interval, so a daily task with
  // a 5-day service is due on its trigger date rather than four days into the
  // next four occurrences. Applying it here too means the deadline is right
  // from creation instead of only after the first cron run.
  let initialSpanDays: number | null = null;
  const storedType =
    typeof task.recurringType === "string"
      ? task.recurringType.toLowerCase()
      : null;
  if (
    storedType &&
    storedType !== "once" &&
    isRecurringType(storedType) &&
    typeof task.recurring === "number" &&
    task.recurring >= 1
  ) {
    initialSpanDays = intervalSpanDays(
      storedType,
      task.recurring,
      storedType === "week" ? normalizeWeekDays(task.recurringWeekDays) : [],
    );
  }

  const nextDueDate = occurrenceDeadline(
    new Date(periodStart),
    task.category?.timePeriod,
    initialSpanDays,
  );

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      currentPeriodStart: new Date(periodStart),
      nextDueDate,
    },
  });

  console.log(
    `🔄 Initialized task schedule. Next due: ${nextDueDate.toISOString()}`,
  );
  return updatedTask;
}

// Get recurring task status info
export function getRecurringTaskStatus(task: {
  recurring?: number | null;
  nextDueDate?: Date | null;
  completed?: boolean;
  currentPeriodStart?: Date | null;
  lastCompletedDate?: Date | null;
  completionHistory?: unknown;
}) {
  if (!task.recurring) {
    return {
      isRecurring: false,
      currentPeriod: null,
      nextDue: null,
      completionCount: 0,
      isOverdue: false,
    };
  }

  const now = new Date();
  const completionHistory = Array.isArray(task.completionHistory)
    ? task.completionHistory
    : [];
  const nextDue = task.nextDueDate ? new Date(task.nextDueDate) : null;
  const isOverdue = nextDue ? now > nextDue && !task.completed : false;

  return {
    isRecurring: true,
    currentPeriod: task.currentPeriodStart
      ? new Date(task.currentPeriodStart)
      : null,
    nextDue,
    completionCount: completionHistory.length,
    isOverdue,
    lastCompleted: task.lastCompletedDate
      ? new Date(task.lastCompletedDate)
      : null,
  };
}

export async function sendActivityEmailsToAgents() {
  // Calculate yesterday's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const endOfYesterday = new Date(today);
  // end of yesterday is start of today (midnight)
  try {
    // Get all agents with their email
    const agents = await prisma.agent.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true },
    });

    if (!agents.length) {
      return;
    }

    // Get all owners for CC
    const owners = await prisma.user.findMany({
      where: { adminType: "owner", status: "active" },
      select: { email: true, username: true },
    });

    const ownerEmails = owners.map((o) => o.email);

    // Send activity email to each agent
    for (const agent of agents) {
      try {
        // Fetch login history for the agent on this date
        const loginHistory = await prisma.loginHistory.findMany({
          where: {
            agentId: agent.id,
            loginAt: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          orderBy: { loginAt: "asc" },
        });

        // Fetch comments added for tasks by this agent
        const comments = await prisma.comment.findMany({
          where: {
            authorId: agent.id,
            createdAt: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          include: { task: true },
          orderBy: { createdAt: "asc" },
        });

        // Fetch timesheet entries for this agent
        const timesheetEntries = await prisma.timesheetEntry.findMany({
          where: {
            agentId: agent.id,
            date: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          orderBy: { date: "asc" },
        });

        // Build HTML email content
        const activityHTML = buildActivityEmailHTML(
          agent.name,
          loginHistory,
          comments,
          timesheetEntries,
          yesterday,
        );

        // Send email to agent with owners CC'd
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"${process.env.COMPANY_NAME || "LegalStanley"}" <${process.env.EMAIL_USER}>`,
          to: agent.email,
          cc: "Riyas.LegalStanley@gmail.com",
          // cc: "ranjithp5841@gmail.com",
          subject: `Daily Activity Report - ${formatDate(yesterday)}`,
          html: activityHTML,
          text: `Activity report for ${agent.name} on ${formatDate(yesterday)}`,
        });
      } catch (error) {
        console.error(`Error sending activity email to ${agent.name}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in sendActivityEmailsToAgents:", error);
  }
}

// Helper function to format date
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

// Helper function to format time
function formatTime(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// Build HTML email with agent activities
function buildActivityEmailHTML(
  agentName: string,
  loginHistory: any[],
  comments: any[],
  timesheetEntries: any[],
  date: Date,
): string {
  const dateStr = formatDate(date);

  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { background-color: #34495e; color: white; padding: 10px; border-radius: 3px; font-weight: bold; margin-bottom: 10px; }
          .activity-item { background-color: #f5f5f5; padding: 10px; margin-bottom: 8px; border-left: 4px solid #3498db; border-radius: 3px; }
          .login-item { border-left-color: #27ae60; }
          .logout-item { border-left-color: #e74c3c; }
          .comment-item { border-left-color: #f39c12; }
          .timesheet-item { border-left-color: #9b59b6; }
          .time-badge { background-color: #ecf0f1; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #ecf0f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Daily Activity Report</h2>
            <p><strong>Professional:</strong> ${agentName}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
          </div>

          ${
            loginHistory.length > 0
              ? `
          <div class="section">
            <div class="section-title">Login/Logout History</div>
            ${loginHistory
              .map((log) => {
                const loginTime = formatTime(log.loginAt);
                const logoutTime = log.logoutAt
                  ? formatTime(log.logoutAt)
                  : "Still Online";
                return `
              <div class="activity-item login-item">
                <strong>Login:</strong> <span class="time-badge">${loginTime}</span>
                <strong>Logout:</strong> <span class="time-badge">${logoutTime}</span>
                ${log.device ? `<br><small>Device: ${log.device}</small>` : ""}
                ${log.location ? `<br><small>Location: ${log.location}</small>` : ""}
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            timesheetEntries.length > 0
              ? `
          <div class="section">
            <div class="section-title">Timesheet Entries</div>
            ${timesheetEntries
              .map((entry) => {
                return `
              <div class="activity-item timesheet-item">
                <strong>${entry.title}</strong><br>
                <span class="time-badge">${entry.startTime} - ${entry.endTime}</span><br>
                ${entry.project ? `<small>Project: ${entry.project}</small><br>` : ""}
                ${entry.description ? `<small>${entry.description}</small><br>` : ""}
                <small>Status: ${entry.status}</small>
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            comments.length > 0
              ? `
          <div class="section">
            <div class="section-title">Comments Added</div>
            ${comments
              .map((comment) => {
                return `
              <div class="activity-item comment-item">
                <strong>${comment.task.title}</strong><br>
                <p>${comment.content}</p>
                <small>
                  ${
                    comment.startTime
                      ? `Start Time: ${formatTime(comment.startTime)}<br>`
                      : ""
                  }
                  ${
                    comment.endTime
                      ? `End Time: ${formatTime(comment.endTime)}`
                      : ""
                  }
                </small>
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            loginHistory.length === 0 &&
            comments.length === 0 &&
            timesheetEntries.length === 0
              ? `
          <div class="section">
            <p><em>No activities recorded for this date.</em></p>
          </div>
          `
              : ""
          }

          <div class="section" style="margin-top:30px;">
            <hr style="border:none; border-top:1px solid #ddd; margin-bottom:15px;" />
            <p style="font-size:12px; font-style:italic; color:#555; line-height:1.6;">
              Please note that the above records reflect the activities undertaken by you on the specified date. 
              You are requested to ensure that all your daily interactions and work activities are properly logged 
              in the system for accurate documentation. Daily reports are regularly reviewed and form the basis 
              for performance evaluation, promotions, bonuses, salary increments, and continuous assessment.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  return html;
}
