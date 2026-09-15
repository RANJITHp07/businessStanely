/**
 * Read-only audit of cron_logs.
 *
 * The unique index on [jobName, runDate] cannot build while more than one row
 * shares a pair, and rows written before `runDate` existed all carry null.
 *
 * Run with: npx tsx scripts/inspect-cron-logs.ts
 */
import prisma from "../src/lib/prisma";

async function main() {
  const rows = await prisma.cronLog.findMany({ orderBy: { ranAt: "asc" } });
  console.log("total rows:", rows.length);
  console.log("rows with null runDate:", rows.filter((r) => !r.runDate).length);

  const byKey = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.jobName}|${row.runDate ?? "NULL"}`;
    byKey.set(key, (byKey.get(key) ?? 0) + 1);
  }

  console.log("\nduplicate (jobName, runDate) pairs:");
  let dupes = 0;
  for (const [key, count] of byKey) {
    if (count > 1) {
      dupes++;
      console.log(`  ${key} -> ${count} rows`);
    }
  }
  if (!dupes) console.log("  none");

  console.log("\nall rows:");
  for (const row of rows) {
    console.log(
      `  ${row.id} | ${row.jobName} | runDate=${row.runDate ?? "NULL"} | ranAt=${row.ranAt.toISOString()} | ${row.status}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
