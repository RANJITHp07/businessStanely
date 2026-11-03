// Moves In Progress tasks with at least one interaction (a comment that is neither
// deleted nor a day track note) already on a 48hr/1w "Instance" duration to the
// StatusCheck & Followup status. Run only after the code that understands the
// status is deployed, otherwise these tasks drop out of the old screens.
//
//   npx tsx scripts/migrate-followup-status.ts             -> dry run, changes nothing
//   npx tsx scripts/migrate-followup-status.ts --apply     -> writes a backup, then updates
//   npx tsx scripts/migrate-followup-status.ts --rollback <backup.json>
//
// Uses DATABASE_URL from the environment; override it to target production.
// Raw commands keep `updatedAt` as it was, since nobody edited these tasks.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { FOLLOW_UP_STATUS } from "../src/lib/taskFollowUp";
import { isDailyTrackContent } from "../src/lib/dailyTrack";

const OPEN_STATUSES = ["In Progress", "in progress", "inprogress", "Progress", "progress"];

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

async function rollback(file: string) {
  const rows: { id: string; status: string }[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const byStatus = new Map<string, string[]>();
  for (const row of rows) byStatus.set(row.status, [...(byStatus.get(row.status) ?? []), row.id]);
  for (const [status, ids] of byStatus) {
    await setStatus(ids, status);
    console.log(`restored ${ids.length} tasks to "${status}"`);
  }
}

async function migrate(apply: boolean) {
  const candidates = await prisma.task.findMany({
    where: {
      active: true,
      status: { in: OPEN_STATUSES },
      followUpDuration: { in: ["48hr", "1w"] },
      // Absent and null are different in MongoDB, and old rows have no field.
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    },
    select: {
      id: true,
      status: true,
      followUpDuration: true,
      comments: { select: { content: true, deletedAt: true } },
    },
  });
  const tasks = candidates
    .filter((t) => t.comments.some((c) => !c.deletedAt && !isDailyTrackContent(c.content)))
    .map(({ id, status, followUpDuration }) => ({ id, status, followUpDuration }));
  console.log(`${candidates.length} candidates, ${candidates.length - tasks.length} without an interaction left alone`);

  const summary: Record<string, number> = {};
  for (const t of tasks) {
    const key = `${t.followUpDuration} / ${t.status}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  console.log(summary, `total ${tasks.length}`);

  if (!apply) {
    console.log("Dry run, nothing changed. Pass --apply to update.");
    return;
  }
  if (tasks.length === 0) return;

  const dir = path.resolve(process.cwd(), "../migration-backups");
  const backup = path.join(dir, `${new Date().toISOString().slice(0, 10)}-followup-status-backup.json`);
  fs.writeFileSync(backup, JSON.stringify(tasks, null, 2));
  console.log(`backup: ${backup}`);

  await setStatus(tasks.map((t) => t.id), FOLLOW_UP_STATUS);
  console.log(`moved ${tasks.length} tasks to "${FOLLOW_UP_STATUS}"`);
}

const args = process.argv.slice(2);
const run = args[0] === "--rollback" ? rollback(args[1]) : migrate(args[0] === "--apply");
run
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
