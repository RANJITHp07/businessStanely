import prisma, { prismaRaw } from "../src/lib/prisma";
async function main() {
  const agents = await prismaRaw.agent.findMany({ select: { id: true, name: true }, take: 20 });
  console.log("agents=" + agents.length);
  const legTotal = await prisma.legislation.count();
  const legWithAgent = await prisma.legislation.count({ where: { assignedAgentId: { not: null } } });
  console.log(JSON.stringify({ legTotal, legWithAgent }));
  for (const a of agents) {
    const n = await prisma.legislation.count({ where: { assignedAgentId: a.id } });
    if (n > 0) console.log(`agent ${a.name} legislation=${n}`);
  }
  // full include path like route
  const sample = await prisma.legislation.findMany({
    take: 2,
    include: { assignedAgent: true, retainership: { include: { client: true } }, tasks: { select: { id: true } } },
  });
  console.log("includeSample=" + sample.length + " retainershipNull=" + sample.filter(s => !s.retainership).length);
  await prismaRaw.$disconnect();
}
main().catch((e) => { console.error("ERR", e.message || e); process.exitCode = 1; });
