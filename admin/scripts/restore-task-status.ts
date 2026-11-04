// Moves tasks off the retired "StatusCheck & Followup" status, now that the group
// comes from the task's Instance duration. A task returns to the status recorded in
// the 2026-11-03 backup. A task not in that backup returns to In Progress if it has
// an interaction (a comment that is neither deleted nor a day track note), else To Do.
// Run right after the code that no longer reads the status is deployed, because
// until then these tasks leave the follow-up group. Safe to run again.
//
//   npx tsx scripts/restore-task-status.ts             -> dry run, changes nothing
//   npx tsx scripts/restore-task-status.ts --apply     -> writes a backup, then updates
//   npx tsx scripts/restore-task-status.ts --rollback <backup.json>
//
// Uses DATABASE_URL from the environment; override it to target production.
// Raw commands keep `updatedAt` as it was, since nobody edited these tasks.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { isFollowUpTask } from "../src/lib/taskFollowUp";
import { isDailyTrackContent } from "../src/lib/dailyTrack";

const RETIRED_STATUS = "StatusCheck & Followup";
const BACKUP_DIR = path.resolve(process.cwd(), "../migration-backups");
const ORIGINAL_STATUSES = path.join(BACKUP_DIR, "2026-11-03-followup-status-backup.json");

const prisma = new PrismaClient();

const setStatus = (ids: string[], status: string) =>
  prisma.$runCommandRaw({
    update: "Task",
    updates: [
      {
        q: { _id: { $in: ids.map((id) => ({ $oid: id })) } },
        u: { $set: { status } },
        multi: true,
      },
    ],
  });

async function applyStatuses(rows: { id: string; status: string }[]) {
  const byStatus = new Map<string, string[]>();
  for (const row of rows) byStatus.set(row.status, [...(byStatus.get(row.status) ?? []), row.id]);
  for (const [status, ids] of byStatus) {
    await setStatus(ids, status);
    console.log(`set ${ids.length} tasks to "${status}"`);
  }
}

async function restore(apply: boolean) {
  const originals: { id: string; status: string }[] = JSON.parse(
    fs.readFileSync(ORIGINAL_STATUSES, "utf8"),
  );
  const originalById = new Map(originals.map((row) => [row.id, row.status]));

  const tasks = await prisma.task.findMany({
    where: { status: RETIRED_STATUS },
    select: {
      id: true,
      followUpDuration: true,
      active: true,
      comments: { select: { content: true, deletedAt: true } },
    },
  });

  const plan = tasks.map((t) => {
    const interacted = t.comments.some((c) => !c.deletedAt && !isDailyTrackContent(c.content));
    const status = originalById.get(t.id) ?? (interacted ? "In Progress" : "To Do");
    return {
      id: t.id,
      status,
      followUpDuration: t.followUpDuration,
      fromBackup: originalById.has(t.id),
      staysInGroup: isFollowUpTask({ status, followUpDuration: t.followUpDuration, active: t.active }),
    };
  });

  const summary: Record<string, number> = {};
  for (const row of plan) {
    const key = `${row.status} / ${row.followUpDuration} / ${row.fromBackup ? "from backup" : "inferred"} / ${row.staysInGroup ? "in group" : "LEAVES GROUP"}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  console.log(summary, `total ${plan.length}`);

  if (!apply) {
    console.log("Dry run, nothing changed. Pass --apply to update.");
    return;
  }
  if (plan.length === 0) return;

  const backup = path.join(BACKUP_DIR, `${new Date().toISOString().slice(0, 10)}-restore-task-status-backup.json`);
  fs.writeFileSync(backup, JSON.stringify(plan.map(({ id }) => ({ id, status: RETIRED_STATUS })), null, 2));
  console.log(`backup: ${backup}`);

  await applyStatuses(plan);
}

async function rollback(file: string) {
  await applyStatuses(JSON.parse(fs.readFileSync(file, "utf8")));
}

const args = process.argv.slice(2);
const run = args[0] === "--rollback" ? rollback(args[1]) : restore(args[0] === "--apply");
run
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
