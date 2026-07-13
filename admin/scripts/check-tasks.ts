import prisma from "../src/lib/prisma";

async function main() {
  const all = await prisma.task.findMany({
    where: {
      createdAt: { gte: new Date("2026-02-14T00:00:00.000Z"), lt: new Date("2026-02-20T00:00:00.000Z") },
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      dueDate: true,
      triggerDate: true,
      nextDueDate: true,
      recurring: true,
      recurringType: true,
    },
  });
  console.log(`found ${all.length}`);
  for (const t of all) {
    console.log(JSON.stringify(t));
  }
}

main().finally(() => prisma.$disconnect());
