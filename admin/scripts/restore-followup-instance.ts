// Puts back the 48hr/1w Instance on tasks the old follow-up sweep changed to Working.
// That sweep left three marks, and all are required here: the task has no
// `followUpUntil`, its latest Instance audit went from 48hr/1w to Working, and that
// audit has no agent on it. A person choosing Working keeps `followUpUntil`, so those
// tasks are left alone. Only `followUpDuration` is written. Safe to run again.
//
//   npx tsx scripts/restore-followup-instance.ts             -> dry run, changes nothing
//   npx tsx scripts/restore-followup-instance.ts --apply     -> writes a backup, then updates
//   npx tsx scripts/restore-followup-instance.ts --rollback <backup.json>
//
// Uses DATABASE_URL from the environment; override it to target production.
// Raw commands keep `updatedAt` as it was, since nobody edited these tasks.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const oid = (id: string) => ({ $oid: id });
const INSTANCES = ["48hr", "1w"];
const today = new Date().toISOString().slice(0, 10);

type BackupRow = { id: string; followUpDuration: string };

async function buildPlan() {
  const tasks = await prisma.task.findMany({
    where: {
      followUpDuration: "Working",
      active: true,
      status: { in: ["In Progress", "in progress", "inprogress", "Progress", "progress"] },
      OR: [{ followUpUntil: null }, { followUpUntil: { isSet: false } }],
    },
    select: {
      id: true,
      title: true,
      durationAudits: {
        where: { field: "followUpDuration" },
        select: {
          oldValue: true,
          newValue: true,
          changedByAgentId: true,
        },
        orderBy: { changedAt: "desc" },
        take: 1,
      },
    },
  });

  return tasks.flatMap((t) => {
    const audit = t.durationAudits[0];
    if (
      !audit ||
      audit.newValue !== "Working" ||
      audit.changedByAgentId ||
      !INSTANCES.includes(audit.oldValue ?? "")
    ) {
      return [];
    }
    return [{ id: t.id, title: t.title, followUpDuration: audit.oldValue! }];
  });
}

async function restore(apply: boolean) {
  const plan = await buildPlan();
  for (const row of plan) {
    console.log(row.id, `Working -> ${row.followUpDuration}`, row.title);
  }
  console.log(`total ${plan.length}`);

  if (!apply) {
    console.log("Dry run, nothing changed. Pass --apply to update.");
    return;
  }
  if (plan.length === 0) return;

  const backup: BackupRow[] = plan.map(({ id, followUpDuration }) => ({ id, followUpDuration }));
  const file = path.resolve(
    process.cwd(),
    "../migration-backups",
    `${today}-restore-followup-instance-backup.json`,
  );
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`backup: ${file}`);

  await prisma.$runCommandRaw({
    update: "Task",
    updates: backup.map((row) => ({
      q: { _id: oid(row.id), followUpDuration: "Working" },
      u: { $set: { followUpDuration: row.followUpDuration } },
    })),
  });
  console.log(`restored ${plan.length} tasks`);
}

async function rollback(file: string) {
  const rows: BackupRow[] = JSON.parse(fs.readFileSync(file, "utf8"));
  await prisma.$runCommandRaw({
    update: "Task",
    updates: rows.map((row) => ({
      q: { _id: oid(row.id) },
      u: { $set: { followUpDuration: "Working" } },
    })),
  });
  console.log(`rolled back ${rows.length} tasks`);
}

const args = process.argv.slice(2);
const run = args[0] === "--rollback" ? rollback(args[1]) : restore(args[0] === "--apply");
run
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
