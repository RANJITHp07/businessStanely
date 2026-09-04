/**
 * Backfill nextDueDate / currentPeriodStart for tasks created before the
 * deadline was derived from (triggerDate ?? dueDate) + the service's timePeriod.
 *
 * Dry run by default; pass --apply to write.
 *   npx tsx scripts/backfill-next-due.ts
 *   npx tsx scripts/backfill-next-due.ts --apply
 */
import prisma from "../src/lib/prisma";

const apply = process.argv.includes("--apply");

async function main() {
  const tasks = await prisma.task.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      dueDate: true,
      triggerDate: true,
      nextDueDate: true,
      category: { select: { timePeriod: true } },
    },
  });

  let changed = 0;

  for (const task of tasks) {
    const periodStart = task.triggerDate ?? task.dueDate;
    if (!periodStart) continue;

    const expected = new Date(periodStart);
    if (task.category?.timePeriod) {
      expected.setDate(expected.getDate() + Number(task.category.timePeriod));
    }

    if (task.nextDueDate?.getTime() === expected.getTime()) continue;

    changed++;
    console.log(
      `${task.id} "${task.title}" ${
        task.nextDueDate?.toISOString() ?? "null"
      } -> ${expected.toISOString()}`,
    );

    if (apply) {
      await prisma.task.update({
        where: { id: task.id },
        data: { nextDueDate: expected, currentPeriodStart: new Date(periodStart) },
      });
    }
  }

  console.log(
    `\n${changed} task(s) ${apply ? "updated" : "would be updated (dry run; pass --apply)"}.`,
  );
}

main().finally(() => prisma.$disconnect());
