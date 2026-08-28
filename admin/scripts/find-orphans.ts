import { prismaRaw as prisma } from "../src/lib/prisma";

/**
 * Detects records whose parent document no longer exists.
 *
 * Retainerships and legislations are now soft deleted and every removal is
 * recorded in DeletionAudit, so new orphans should not appear. This remains
 * useful for finding rows orphaned by hard deletes that happened before soft
 * delete shipped.
 *
 * Uses the unfiltered client on purpose: a task pointing at a soft-deleted
 * parent is not an orphan, so parents must be counted whether deleted or not.
 *
 * Run: npx tsx scripts/find-orphans.ts
 */
async function main() {
  const retainershipIds = new Set(
    (await prisma.retainership.findMany({ select: { id: true } })).map((r) => r.id)
  );
  const legislationIds = new Set(
    (await prisma.legislation.findMany({ select: { id: true } })).map((l) => l.id)
  );

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ retainershipId: { not: null } }, { legislationId: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      active: true,
      clientId: true,
      assignedToId: true,
      retainershipId: true,
      legislationId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const orphans = tasks.filter(
    (t) =>
      (t.retainershipId && !retainershipIds.has(t.retainershipId)) ||
      (t.legislationId && !legislationIds.has(t.legislationId))
  );

  console.log(`tasks with a parent link: ${tasks.length}`);
  console.log(`orphaned tasks: ${orphans.length}\n`);

  if (orphans.length === 0) {
    console.log("No orphans. No retainership/legislation delete left task evidence.");
  }

  // Group by the missing parent so each group is one deleted retainership or legislation.
  const groups = new Map<string, typeof orphans>();
  for (const t of orphans) {
    const missingRetainership =
      t.retainershipId && !retainershipIds.has(t.retainershipId)
        ? `retainership:${t.retainershipId}`
        : null;
    const missingLegislation =
      t.legislationId && !legislationIds.has(t.legislationId)
        ? `legislation:${t.legislationId}`
        : null;
    const key = [missingRetainership, missingLegislation].filter(Boolean).join(" + ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  for (const [key, list] of groups) {
    // An ObjectId embeds its creation time, so a missing parent still reveals when it was made.
    const rawId = key.split(":")[1]?.split(" ")[0];
    const createdAt = rawId ? new Date(parseInt(rawId.slice(0, 8), 16) * 1000) : null;

    console.log(`\n=== missing parent ${key}`);
    if (createdAt) console.log(`    parent created: ${createdAt.toISOString()}`);
    console.log(`    orphaned tasks: ${list.length}`);
    console.log(`    clients: ${new Set(list.map((t) => t.clientId)).size}`);
    console.log(`    last task update: ${list[0].updatedAt.toISOString()}  (delete happened after this)`);
    for (const t of list) {
      console.log(
        `      - ${t.id}  ${t.active ? "active " : "inactive"}  ${t.status.padEnd(12)}  ${t.title}`
      );
    }
  }

  // Legislations whose retainership is gone (cascade should prevent this, so any hit means
  // the retainership was removed outside Prisma).
  const strandedLegislations = (
    await prisma.legislation.findMany({
      select: { id: true, title: true, retainershipId: true, createdAt: true },
    })
  ).filter((l) => !retainershipIds.has(l.retainershipId));

  console.log(`\n\nlegislations with a missing retainership: ${strandedLegislations.length}`);
  for (const l of strandedLegislations) {
    console.log(`  - ${l.id}  retainership:${l.retainershipId}  ${l.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
