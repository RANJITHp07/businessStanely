/**
 * Read-only audit: how many live retainership tasks carry a nextDueDate that
 * does not equal (triggerDate ?? dueDate) + the service's timePeriod.
 *
 * Run with: npx tsx scripts/check-next-due.ts
 */
import prisma from "../src/lib/prisma";

function expectedNextDue(
  triggerDate: Date | null,
  dueDate: Date | null,
  timePeriod: number | null | undefined,
): Date | null {
  const periodStart = triggerDate ?? dueDate;
  if (!periodStart) return null;
  const expected = new Date(periodStart);
  if (timePeriod) expected.setDate(expected.getDate() + Number(timePeriod));
  return expected;
}

async function main() {
  const tasks = await prisma.task.findMany({
    where: { deletedAt: null, retainershipId: { not: null } },
    select: {
      id: true,
      title: true,
      dueDate: true,
      triggerDate: true,
      nextDueDate: true,
      category: { select: { name: true, timePeriod: true } },
    },
  });

  let missing = 0;
  let wrong = 0;

  for (const task of tasks) {
    const expected = expectedNextDue(
      task.triggerDate,
      task.dueDate,
      task.category?.timePeriod,
    );
    if (!expected) continue;

    if (!task.nextDueDate) {
      missing++;
      continue;
    }
    if (task.nextDueDate.getTime() !== expected.getTime()) {
      wrong++;
      console.log(
        `${task.id} "${task.title}" service=${task.category?.name ?? "-"} ` +
          `days=${task.category?.timePeriod ?? "-"} ` +
          `trigger=${task.triggerDate?.toISOString() ?? "-"} ` +
          `stored=${task.nextDueDate.toISOString()} ` +
          `expected=${expected.toISOString()}`,
      );
    }
  }

  console.log(
    `\n${tasks.length} live retainership tasks: ${missing} missing nextDueDate, ${wrong} mismatched.`,
  );
}

main().finally(() => prisma.$disconnect());
