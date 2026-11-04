import prisma from "@/lib/prisma";
import { istDateKey, istDayRange } from "@/lib/dailyTrack";
import { FOLLOW_UP_WHERE, nextFollowUpDue } from "@/lib/taskFollowUp";

// Keep this file identical in `agent/src/lib` and `admin/src/lib`.

const SWEEP_INTERVAL_MS = 60 * 1000;
let lastSweepAt = 0;

/**
 * Moves Task.followUpUntil on to the next due day once a follow-up's due day has
 * passed, so the task returns to the Followups group. Nothing else on the task
 * changes. Task reads call this because the only scheduler runs once a day. Never
 * throws, so it cannot break the read that triggered it.
 */
export async function expireFollowUps() {
  if (Date.now() - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = Date.now();

  try {
    const today = istDayRange(istDateKey())!.start;
    const tasks = await prisma.task.findMany({
      where: { ...FOLLOW_UP_WHERE, followUpUntil: { lt: today } },
      select: { id: true, followUpDuration: true, followUpUntil: true, updatedAt: true },
    });

    for (const task of tasks) {
      await prisma.task.update({
        where: { id: task.id },
        // updatedAt is kept: moving the cycle on is not an edit to the task.
        data: { followUpUntil: nextFollowUpDue(task), updatedAt: task.updatedAt },
      });
    }
  } catch (error) {
    console.error("Error moving follow-ups to their next due day:", error);
  }
}
