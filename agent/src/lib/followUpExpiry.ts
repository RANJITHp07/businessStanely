import prisma from "@/lib/prisma";
import { FOLLOW_UP_WHERE } from "@/lib/taskFollowUp";

// Keep this file identical in `agent/src/lib` and `admin/src/lib`.

const SWEEP_INTERVAL_MS = 60 * 1000;
let lastSweepAt = 0;

/**
 * Returns Followups tasks whose wait has ended to In Progress by resetting their
 * Instance to Working. Task reads call this because the only scheduler runs once
 * a day; a wait therefore ends within a minute of the next read. Never throws, so
 * it cannot break the read that triggered it.
 */
export async function expireFollowUps() {
  if (Date.now() - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = Date.now();

  try {
    const tasks = await prisma.task.findMany({
      where: { ...FOLLOW_UP_WHERE, followUpUntil: { lt: new Date() } },
      select: { id: true, followUpDuration: true },
    });
    if (tasks.length === 0) return;

    await prisma.task.updateMany({
      where: { id: { in: tasks.map((t) => t.id) } },
      data: { followUpDuration: "Working", followUpUntil: null },
    });

    // Same one-row-per-day audit as a manual Instance change; the dashboard
    // status check reads the latest audit as the task's duration.
    const today = new Date().toISOString().slice(0, 10);
    for (const task of tasks) {
      const existing = await prisma.taskDurationAudit.findFirst({
        where: { taskId: task.id, field: "followUpDuration", auditDate: today },
      });
      if (existing) {
        await prisma.taskDurationAudit.update({
          where: { id: existing.id },
          data: { newValue: "Working" },
        });
      } else {
        await prisma.taskDurationAudit.create({
          data: {
            taskId: task.id,
            field: "followUpDuration",
            oldValue: task.followUpDuration,
            newValue: "Working",
            auditDate: today,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error expiring follow-ups:", error);
  }
}
