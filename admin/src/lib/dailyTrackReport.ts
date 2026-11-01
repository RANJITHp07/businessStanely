import prisma from "@/lib/prisma";
import {
  DAILY_TRACK_MATCH,
  DAILY_TRACK_STATUSES,
  istDayRange,
} from "@/lib/dailyTrack";

export interface MissingDailyTrackTask {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  clientName: string;
  agent: { id: string; name: string; email: string };
}

/**
 * In Progress tasks whose assigned agent wrote no daily track note on them
 * during the IST day `dateKey`, plus how many In Progress tasks each agent had.
 *
 * Status is read as it is now, not as it was on `dateKey`, so a past date
 * lists tasks that are In Progress today. Tasks created after that day are
 * left out, as are tasks of inactive or removed agents.
 */
export async function findMissingDailyTrack(dateKey: string, agentId?: string) {
  const range = istDayRange(dateKey);
  if (!range) return null;

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
      priority: true,
      dueDate: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true, status: true } },
      client: {
        select: {
          clientType: true,
          firstName: true,
          lastName: true,
          organizationName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const liveTasks = tasks.filter(
    (t) => t.assignedTo && t.assignedTo.status?.toLowerCase() !== "inactive",
  );

  const tracked = await prisma.comment.findMany({
    where: {
      taskId: { in: liveTasks.map((t) => t.id) },
      content: { startsWith: DAILY_TRACK_MATCH },
      createdAt: { gte: range.start, lt: range.end },
    },
    select: { taskId: true, authorId: true },
  });
  // Only the assignee's own note counts; a superior commenting does not
  // discharge the agent's daily track.
  const trackedKeys = new Set(tracked.map((c) => `${c.taskId}:${c.authorId}`));

  const inProgressByAgent = new Map<string, number>();
  const missing: MissingDailyTrackTask[] = [];
  for (const t of liveTasks) {
    const agent = t.assignedTo!;
    inProgressByAgent.set(agent.id, (inProgressByAgent.get(agent.id) ?? 0) + 1);
    if (trackedKeys.has(`${t.id}:${agent.id}`)) continue;

    const c = t.client;
    const clientName = c
      ? c.clientType?.toLowerCase() === "individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
        : c.organizationName ?? ""
      : "";
    missing.push({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      clientName,
      agent: { id: agent.id, name: agent.name, email: agent.email },
    });
  }

  return { range, missing, inProgressByAgent };
}

/** Latest daily track note before `before` for each task, keyed by task id. */
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
