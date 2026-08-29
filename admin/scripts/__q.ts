import { prismaRaw } from "../src/lib/prisma";

const d = (x: Date | null) => x ? new Date(x).toISOString().slice(0,10) : "N/A";

async function main() {
  const tasks = await prismaRaw.task.findMany({
    where: { clientId: "68a6d3033397fc962468a3f0" },
    include: { ownerShipBy: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  console.log("id                        owner            status       due         lastCompleted  active  title");
  for (const t of tasks) {
    console.log([
      t.id,
      (t.ownerShipBy?.name ?? "-").slice(0,15).padEnd(16),
      (t.status ?? "").padEnd(12),
      d(t.dueDate).padEnd(11),
      d(t.lastCompletedDate).padEnd(14),
      String(t.active).padEnd(7),
      (t.title ?? "").slice(0,42),
    ].join(" "));
  }
}
main().catch(console.error).finally(() => process.exit(0));
