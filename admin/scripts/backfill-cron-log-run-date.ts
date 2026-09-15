/**
 * Backfills CronLog.runDate on rows written before the field existed.
 *
 * The unique index on [jobName, runDate] is what makes the daily job's claim
 * atomic, but `db push` cannot build it while two rows share a pair -- and in
 * MongoDB every legacy row carries a null runDate, so a second legacy row for
 * the same job is a duplicate. That is the "E11000 dup key ... runDate: null"
 * failure seen on deploy.
 *
 * Each row is stamped with the day it actually ran (from ranAt), which is the
 * value the row would have carried had the field existed. Rows that would still
 * collide after that -- two runs of the same job on the same day, which is the
 * double-run the index exists to prevent -- keep the newest and delete the rest,
 * since the job's own history is the only thing lost and the newest row is the
 * one whose status reflects the final outcome.
 *
 * Idempotent: rows that already have a runDate are untouched.
 *
 * Run with: npx tsx --env-file=.env scripts/backfill-cron-log-run-date.ts
 * Add --apply to write; without it the script only reports.
 */
import { prismaRaw as prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

async function main() {
  const rows = await prisma.cronLog.findMany({ orderBy: { ranAt: "asc" } });
  const legacy = rows.filter((row) => !row.runDate);

  console.log(`cron_logs rows: ${rows.length}`);
  console.log(`rows missing runDate: ${legacy.length}`);

  if (legacy.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  // Group by the pair the index will enforce, counting rows that already carry
  // a runDate too -- a legacy row can collide with a modern one.
  const claimed = new Map<string, string>();
  for (const row of rows) {
    if (row.runDate) claimed.set(`${row.jobName}|${row.runDate}`, row.id);
  }

  const updates: { id: string; runDate: string }[] = [];
  const deletions: string[] = [];

  for (const row of legacy) {
    const runDate = dayKey(row.ranAt);
    const key = `${row.jobName}|${runDate}`;

    if (claimed.has(key)) {
      // Another row already owns this day. Ordered by ranAt ascending, so the
      // row already holding the key is the older one -- it loses to this one.
      deletions.push(claimed.get(key)!);
    }

    claimed.set(key, row.id);
    updates.push({ id: row.id, runDate });
  }

  console.log(`\nwould set runDate on ${updates.length} row(s)`);
  for (const update of updates) {
    console.log(`  ${update.id} -> ${update.runDate}`);
  }

  console.log(`\nwould delete ${deletions.length} superseded row(s)`);
  for (const id of deletions) console.log(`  ${id}`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    return;
  }

  for (const id of deletions) {
    await prisma.cronLog.delete({ where: { id } });
  }
  for (const update of updates) {
    await prisma.cronLog.update({
      where: { id: update.id },
      data: { runDate: update.runDate },
    });
  }

  console.log("\nDone. `npx prisma db push` can now build the unique index.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
