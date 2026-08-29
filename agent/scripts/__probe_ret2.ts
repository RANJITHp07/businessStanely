import prisma, { prismaRaw } from "../src/lib/prisma";
async function main() {
  const raw = await prismaRaw.retainership.count();
  const explicit = await prismaRaw.retainership.count({ where: { deletedAt: null } });
  const ext = await prisma.retainership.findMany({ select: { id: true, status: true } });
  console.log(JSON.stringify({ raw, explicit, extCount: ext.length }));
  const approved = await prisma.retainership.findMany({
    where: { status: "approved" },
    include: { client: { select: { id: true } }, createdByAgent: { select: { id: true } } },
  });
  console.log("approvedViaExtInclude=" + approved.length);
  const leg = await prisma.legislation.count();
  console.log("legislationExtCount=" + leg);
  await prismaRaw.$disconnect();
}
main().catch((e) => { console.error("ERR", e.message || e); process.exitCode = 1; });
