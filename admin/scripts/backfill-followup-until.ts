// Gives tasks already in the Followups group an end to their wait. The wait counts
// from the latest Instance audit for the task's current duration, else from when the
// task was last updated. A wait already over is moved on to its next due day at the
// next task read, keeping its Instance. Only tasks without a `followUpUntil` are
// touched, so it is safe to run again.
//
//   npx tsx scripts/backfill-followup-until.ts             -> dry run, changes nothing
//   npx tsx scripts/backfill-followup-until.ts --apply     -> writes a backup, then updates
//   npx tsx scripts/backfill-followup-until.ts --rollback <backup.json>
//
// Uses DATABASE_URL from the environment; override it to target production.
// Raw commands keep `updatedAt` as it was, since nobody edited these tasks.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { FOLLOW_UP_WHERE, followUpTimer } from "../src/lib/taskFollowUp";

const prisma = new PrismaClient();

const oid = (id: string) => ({ $oid: id });

async function backfill(apply: boolean) {
  const tasks = await prisma.task.findMany({
    where: {
      ...FOLLOW_UP_WHERE,
      OR: [{ followUpUntil: null }, { followUpUntil: { isSet: false } }],
    },
    select: {
      id: true,
      followUpDuration: true,
      updatedAt: true,
      durationAudits: {
        where: { field: "followUpDuration" },
        select: { newValue: true, changedAt: true },
        orderBy: { changedAt: "desc" },
      },
    },
  });

  const now = Date.now();
  const plan = tasks.map((t) => {
    const audit = t.durationAudits.find((a) => a.newValue === t.followUpDuration);
    const startedAt = audit?.changedAt ?? t.updatedAt;
    const { followUpUntil } = followUpTimer(
      {},
      { status: "In Progress", followUpDuration: t.followUpDuration },
      startedAt.getTime(),
    );
    return { id: t.id, followUpDuration: t.followUpDuration, fromAudit: !!audit, followUpUntil: followUpUntil! };
  });

  const summary: Record<string, number> = {};
  for (const row of plan) {
    const key = `${row.followUpDuration} / ${row.fromAudit ? "from audit" : "from updatedAt"} / ${row.followUpUntil.getTime() < now ? "WAIT OVER, moves to next due day" : "stays in Followups"}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  console.log(summary, `total ${plan.length}`);

  if (!apply) {
    console.log("Dry run, nothing changed. Pass --apply to update.");
    return;
  }
  if (plan.length === 0) return;

  const backup = path.resolve(
    process.cwd(),
    "../migration-backups",
    `${new Date().toISOString().slice(0, 10)}-backfill-followup-until-backup.json`,
  );
  fs.writeFileSync(backup, JSON.stringify(plan.map(({ id }) => id), null, 2));
  console.log(`backup: ${backup}`);

  await prisma.$runCommandRaw({
    update: "Task",
    updates: plan.map((row) => ({
      q: { _id: oid(row.id) },
      u: { $set: { followUpUntil: { $date: row.followUpUntil.toISOString() } } },
    })),
  });
  console.log(`set followUpUntil on ${plan.length} tasks`);
}

async function rollback(file: string) {
  const ids: string[] = JSON.parse(fs.readFileSync(file, "utf8"));
  await prisma.$runCommandRaw({
    update: "Task",
    updates: [{ q: { _id: { $in: ids.map(oid) } }, u: { $unset: { followUpUntil: "" } }, multi: true }],
  });
  console.log(`cleared followUpUntil on ${ids.length} tasks`);
}

const args = process.argv.slice(2);
const run = args[0] === "--rollback" ? rollback(args[1]) : backfill(args[0] === "--apply");
run
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
