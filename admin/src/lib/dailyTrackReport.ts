import prisma from "@/lib/prisma";
import {
  DAILY_TRACK_MATCH,
  DAILY_TRACK_STATUSES,
  istDayRange,
  stripDailyTrackPrefix,
} from "@/lib/dailyTrack";
import { expireFollowUps } from "@/lib/followUpExpiry";
import { needsDayTrackOn } from "@/lib/taskFollowUp";

export interface DailyTrackAgent {
  id: string;
  name: string;
  email: string;
}

export interface DailyTrackTask {
  id: string;
  title: string;
  dueDate: Date | null;
  clientName: string;
  /** Linked to a retainership or legislation, the same test the task page uses. */
  isRetainership: boolean;
  agent: DailyTrackAgent;
  /** The assignee's note for the day, or null when they have not tracked it. */
  note: { content: string; createdAt: Date; updatedAt: Date } | null;
}

const CLIENT_NAME_SELECT = {
  clientType: true,
  firstName: true,
  lastName: true,
  organizationName: true,
} as const;

/**
 * Every In Progress task with its assigned agent's day track note for the IST
 * day `dateKey` (null when there is none), plus the agents those tasks belong to.
 * Tasks in the Followups group (48hr/1w Instance) are listed only on the days
 * their cycle needs a day track.
 *
 * Status is read as it is now, not as it was on `dateKey`, so a past date
 * lists tasks that are In Progress today. Tasks created after that day are
 * left out, as are tasks of inactive or removed agents.
 */
export async function buildDailyTrackReport(dateKey: string, agentId?: string) {
  const range = istDayRange(dateKey);
  if (!range) return null;

  await expireFollowUps();

  const tasks = await prisma.task.findMany({
    where: {
      status: { in: DAILY_TRACK_STATUSES },
      active: true,
      assignedToId: agentId ?? { not: null },
      createdAt: { lt: range.end },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      active: true,
      followUpDuration: true,
      followUpUntil: true,
      legislationId: true,
      retainershipId: true,
      assignedTo: { select: { id: true, name: true, email: true, status: true } },
      client: { select: CLIENT_NAME_SELECT },
      // Retainership tasks may carry no clientId of their own.
      retainership: { select: { client: { select: CLIENT_NAME_SELECT } } },
      legislation: {
        select: {
          retainership: { select: { client: { select: CLIENT_NAME_SELECT } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const liveTasks = tasks.filter(
    (t) =>
      t.assignedTo &&
      t.assignedTo.status?.toLowerCase() !== "inactive" &&
      needsDayTrackOn(t, dateKey),
  );

  const comments = await prisma.comment.findMany({
    where: {
      taskId: { in: liveTasks.map((t) => t.id) },
      content: { startsWith: DAILY_TRACK_MATCH },
      createdAt: { gte: range.start, lt: range.end },
    },
    select: {
      taskId: true,
      authorId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  // Only the assignee's own note counts; a superior commenting does not
  // discharge the agent's day track.
  const notes = new Map(comments.map((c) => [`${c.taskId}:${c.authorId}`, c]));

  const agents = new Map<string, DailyTrackAgent>();
  const rows: DailyTrackTask[] = liveTasks.map((t) => {
    const { id, name, email } = t.assignedTo!;
    agents.set(id, { id, name, email });

    const c =
      t.client ?? t.retainership?.client ?? t.legislation?.retainership?.client;
    const clientName = c
      ? c.clientType?.toLowerCase() === "individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
        : c.organizationName ?? ""
      : "";
    const note = notes.get(`${t.id}:${id}`);
    return {
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      clientName,
      isRetainership: !!(t.legislationId || t.retainershipId),
      agent: { id, name, email },
      note: note
        ? {
            content: stripDailyTrackPrefix(note.content),
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          }
        : null,
    };
  });

  return { range, tasks: rows, agents };
}

/** Latest day track note before `before` for each task, keyed by task id. */
export async function lastDailyTrackDates(taskIds: string[], before: Date) {
  if (taskIds.length === 0) return new Map<string, Date>();
  const comments = await prisma.comment.findMany({
    where: {
      taskId: { in: taskIds },
      content: { startsWith: DAILY_TRACK_MATCH },
      createdAt: { lt: before },
    },
    select: { taskId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, Date>();
  for (const c of comments) {
    if (c.taskId && !latest.has(c.taskId)) latest.set(c.taskId, c.createdAt);
  }
  return latest;
}
