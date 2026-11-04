// Puts back the 48hr/1w Instance on tasks the old follow-up sweep changed to Working.
// That sweep left three marks, and all are required here: the task has no
// `followUpUntil`, its latest Instance audit went from 48hr/1w to Working, and that
// audit has no agent on it. A person choosing Working keeps `followUpUntil`, so those
// tasks are left alone. The task's next due day counts from the day it was changed.
// Run after the code without that sweep is deployed. Safe to run again.
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

type BackupRow = {
  id: string;
  followUpDuration: string;
  followUpUntil: string;
  /** Today's audit row this script rewrote, or the one it added. */
  auditId: string;
  auditCreated: boolean;
};

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
          id: true,
          oldValue: true,
          newValue: true,
          auditDate: true,
          changedAt: true,
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
    return [
      {
        id: t.id,
        title: t.title,
        followUpDuration: audit.oldValue!,
        followUpUntil: audit.changedAt,
        todayAuditId: audit.auditDate === today ? audit.id : null,
      },
    ];
  });
}

async function restore(apply: boolean) {
  const plan = await buildPlan();
  for (const row of plan) {
    console.log(row.id, `Working -> ${row.followUpDuration}`, row.followUpUntil.toISOString().slice(0, 10), row.title);
  }
  console.log(`total ${plan.length}`);

  if (!apply) {
    console.log("Dry run, nothing changed. Pass --apply to update.");
    return;
  }
  if (plan.length === 0) return;

  // The dashboard status check reads the latest audit as the task's duration.
  const backup: BackupRow[] = [];
  const file = path.resolve(
    process.cwd(),
    "../migration-backups",
    `${today}-restore-followup-instance-backup.json`,
  );
  for (const row of plan) {
    await prisma.$runCommandRaw({
      update: "Task",
      updates: [
        {
          q: { _id: oid(row.id), followUpDuration: "Working" },
          u: {
            $set: {
              followUpDuration: row.followUpDuration,
              followUpUntil: { $date: row.followUpUntil.toISOString() },
            },
          },
        },
      ],
    });
    const audit = row.todayAuditId
      ? await prisma.taskDurationAudit.update({
          where: { id: row.todayAuditId },
          data: { newValue: row.followUpDuration },
        })
      : await prisma.taskDurationAudit.create({
          data: {
            taskId: row.id,
            field: "followUpDuration",
            oldValue: "Working",
            newValue: row.followUpDuration,
            auditDate: today,
          },
        });
    backup.push({
      id: row.id,
      followUpDuration: row.followUpDuration,
      followUpUntil: row.followUpUntil.toISOString(),
      auditId: audit.id,
      auditCreated: !row.todayAuditId,
    });
    // Rewritten per row, so a run that stops partway can still be rolled back.
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  }
  console.log(`backup: ${file}`);
  console.log(`restored ${plan.length} tasks`);
}

async function rollback(file: string) {
  const rows: BackupRow[] = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const row of rows) {
    await prisma.$runCommandRaw({
      update: "Task",
      updates: [
        {
          q: { _id: oid(row.id) },
          u: { $set: { followUpDuration: "Working" }, $unset: { followUpUntil: "" } },
        },
      ],
    });
    if (row.auditCreated) {
      await prisma.taskDurationAudit.delete({ where: { id: row.auditId } });
    } else {
      await prisma.taskDurationAudit.update({
        where: { id: row.auditId },
        data: { newValue: "Working" },
      });
    }
  }
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
