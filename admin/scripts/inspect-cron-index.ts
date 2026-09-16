/** Read-only: which indexes exist on cron_logs. */
import { prismaRaw as prisma } from "../src/lib/prisma";

async function main() {
  const result: any = await prisma.$runCommandRaw({ listIndexes: "cron_logs" });
  for (const index of result?.cursor?.firstBatch ?? []) {
    console.log(index.name, JSON.stringify(index.key), index.unique ? "UNIQUE" : "");
  }
}

main()
  .catch((error) => console.error("ERR:", error.message))
  .finally(() => prisma.$disconnect());
