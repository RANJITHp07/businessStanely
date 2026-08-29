import prisma from "../src/lib/prisma";

async function main() {
  console.log("model            explicit-null   extension-default");
  for (const m of ["retainership","legislation","client","taskCategory","leadSource"] as const) {
    const d: any = (prisma as any)[m];
    const bad = await d.count({ where: { deletedAt: null } });
    const good = await d.count({});
    console.log(`${m.padEnd(16)} ${String(bad).padStart(8)}   ${String(good).padStart(14)}${bad !== good ? "   <-- BROKEN" : ""}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
