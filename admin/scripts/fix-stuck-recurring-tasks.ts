import prisma from "../src/lib/prisma";
import { updateAllRecurringTasks } from "../src/lib/singleTaskRecurring";

// One-off backfill: the cron's date-window check used to only process a
// recurring task if triggerDate fell within "today", so any day the cron
// didn't run, matching tasks were skipped forever (see fix in
// singleTaskRecurring.ts). Now that the guard also accepts overdue
// triggerDates, this reruns the same logic to catch those tasks up.
async function main() {
  const before = await prisma.task.findMany({
    where: {
      recurring: { not: null },
      recurringType: { not: null },
      triggerDate: { lt: new Date() },
    },
    select: { id: true, title: true, status: true, triggerDate: true },
  });

  console.log(`Found ${before.length} recurring task(s) with an overdue triggerDate:`);
  for (const task of before) {
    console.log(`- ${task.id} | "${task.title}" | status=${task.status} | triggerDate=${task.triggerDate?.toISOString()}`);
  }

  if (process.argv.includes("--dry-run")) {
    console.log("\nDry run only — no changes made. Re-run without --dry-run to apply.");
    return;
  }

  const updated = await updateAllRecurringTasks();
  console.log(`\nDone. ${updated.length} task(s) updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
