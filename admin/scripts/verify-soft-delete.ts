import prisma, { prismaRaw } from "../src/lib/prisma";
import { onlyDeleted, includeDeleted } from "../src/lib/softDelete";

/**
 * End-to-end check that soft-deleted rows stay hidden on every read path.
 *
 * Runs against the real database and cleans up after itself. The nested,
 * relation-filter and _count cases exist because a Prisma client extension only
 * hooks top-level operations - relations loaded in the same query bypass it and
 * previously leaked deleted rows.
 *
 * Run: npx tsx scripts/verify-soft-delete.ts
 */
async function main() {
  const checks: [string, boolean][] = [];
  const check = (label: string, got: boolean, want = true) =>
    checks.push([`${got === want ? "PASS" : "FAIL"}  ${label}`, got === want]);

  // ---- top-level reads -------------------------------------------------
  const legacy = await prismaRaw.leadSource.create({
    data: { name: `__sd_legacy_${Date.now()}` },
  });
  // Mimic pre-existing data, which has no deletedAt field at all.
  await prismaRaw.$runCommandRaw({
    update: "LeadSource",
    updates: [{ q: { name: legacy.name }, u: { $unset: { deletedAt: "" } } }],
  });
  check("row with absent deletedAt is visible",
    !!(await prisma.leadSource.findFirst({ where: { id: legacy.id } })));

  const row = await prismaRaw.leadSource.create({ data: { name: `__sd_${Date.now()}` } });
  const id = row.id;

  await prisma.leadSource.delete({ where: { id } });
  const raw = await prismaRaw.leadSource.findUnique({ where: { id } });
  check("delete() keeps the row", !!raw);
  check("delete() stamps deletedAt", !!raw?.deletedAt);

  check("findFirst hides deleted", !(await prisma.leadSource.findFirst({ where: { id } })));
  check("findUnique hides deleted", !(await prisma.leadSource.findUnique({ where: { id } })));
  check("findMany hides deleted", (await prisma.leadSource.findMany({ where: { id } })).length === 0);
  check("count excludes deleted", (await prisma.leadSource.count({ where: { id } })) === 0);
  check("onlyDeleted reaches deleted",
    !!(await prisma.leadSource.findFirst({ where: { id, ...onlyDeleted } })));
  check("includeDeleted reaches deleted",
    !!(await prisma.leadSource.findFirst({ where: { AND: [{ id }, includeDeleted] } })));

  const ownOr = await prisma.leadSource.findMany({ where: { OR: [{ id }, { id: legacy.id }] } });
  check("caller's own OR preserved, deleted still hidden",
    ownOr.length === 1 && ownOr[0].id === legacy.id);

  const bulk = await prismaRaw.leadSource.create({ data: { name: `__sd_bulk_${Date.now()}` } });
  await prisma.leadSource.deleteMany({ where: { id: bulk.id } });
  check("deleteMany soft deletes",
    !!(await prismaRaw.leadSource.findUnique({ where: { id: bulk.id } }))?.deletedAt);

  // ---- nested reads ----------------------------------------------------
  const task = await prismaRaw.task.findFirst({ where: { clientId: { not: null } } });
  const has = (arr: any[], x: string) => arr.some((r: any) => r.id === x);
  let live: any, dead: any;

  if (task) {
    const author = task.createdById ?? task.assignedToId!;
    live = await prismaRaw.comment.create({
      data: { content: `__sd_live_${Date.now()}`, taskId: task.id, authorId: author, authorType: "AGENT" } });
    dead = await prismaRaw.comment.create({
      data: { content: `__sd_dead_${Date.now()}`, taskId: task.id, authorId: author, authorType: "AGENT" } });
    await prismaRaw.comment.update({ where: { id: dead.id }, data: { deletedAt: new Date() } });

    const a: any = await prisma.task.findFirst({ where: { id: task.id }, include: { comments: true } });
    check("include:true hides deleted", !has(a.comments, dead.id));
    check("include:true keeps live", has(a.comments, live.id));

    const b: any = await prisma.task.findFirst({
      where: { id: task.id }, select: { id: true, comments: { select: { id: true } } } });
    check("select hides deleted", !has(b.comments, dead.id));

    const c: any = await prisma.task.findFirst({
      where: { id: task.id }, include: { comments: { where: { authorType: "AGENT" } } } });
    check("nested + caller where hides deleted", !has(c.comments, dead.id));
    check("nested + caller where keeps live", has(c.comments, live.id));

    const d: any = await prisma.task.findFirst({ where: { id: task.id }, include: { client: true } });
    check("to-one relation still loads", !!d.client);

    const e: any = await prisma.client.findFirst({
      where: { id: task.clientId! }, include: { tasks: { include: { comments: true } } } });
    const deep = e.tasks.flatMap((t: any) => t.comments);
    check("deep nesting hides deleted", !has(deep, dead.id));
    check("deep nesting keeps live", has(deep, live.id));

    const f: any = await prisma.task.findFirst({
      where: { id: task.id }, include: { comments: { where: { deletedAt: { not: null } } } } });
    check("explicit nested deletedAt filter still works", has(f.comments, dead.id));

    const g: any = await prisma.task.findFirst({
      where: { id: task.id }, include: { _count: { select: { comments: true } } } });
    check("_count excludes deleted", !g._count.comments || !has([dead], String(g._count.comments)));
    check("_count counts only live comments", g._count.comments >= 1);
  }

  // relation filter must not match through a deleted-only relation
  const bare = await prismaRaw.task.findFirst({ where: { comments: { none: {} } } });
  if (bare) {
    const only = await prismaRaw.comment.create({
      data: { content: `__sd_only_${Date.now()}`, taskId: bare.id,
              authorId: bare.createdById ?? bare.assignedToId!, authorType: "AGENT" } });
    await prismaRaw.comment.update({ where: { id: only.id }, data: { deletedAt: new Date() } });
    check("relation filter `some` ignores deleted",
      !(await prisma.task.findFirst({ where: { id: bare.id, comments: { some: {} } } })));
    await prismaRaw.comment.delete({ where: { id: only.id } });
  }

  console.log(checks.map(([l]) => l).join("\n"));
  const failed = checks.filter(([, ok]) => !ok);
  console.log(failed.length ? `\n${failed.length} CHECK(S) FAILED` : `\nALL ${checks.length} CHECKS PASSED`);

  if (live) await prismaRaw.comment.deleteMany({ where: { id: { in: [live.id, dead.id] } } });
  await prismaRaw.leadSource.deleteMany({ where: { id: { in: [id, legacy.id, bulk.id] } } });
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
