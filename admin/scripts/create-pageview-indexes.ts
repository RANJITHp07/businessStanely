import { PrismaClient } from '@prisma/client';

// Creates the indexes for page_views (PageView in prisma/schema.prisma), which
// Prisma cannot declare itself:
//   - TTL on createdAt, so page views are deleted 12 months after they happen.
//     It also serves the date-range filter on the Website Analytics page.
// Safe to run more than once: createIndexes is a no-op for an identical index.
//
//   npx tsx scripts/create-pageview-indexes.ts

const prisma = new PrismaClient();

const TWELVE_MONTHS_SECONDS = 365 * 24 * 60 * 60;

async function main() {
  const result = await prisma.$runCommandRaw({
    createIndexes: 'page_views',
    indexes: [
      {
        key: { createdAt: 1 },
        name: 'createdAt_ttl',
        expireAfterSeconds: TWELVE_MONTHS_SECONDS,
      },
    ],
  });
  console.log('createIndexes:', JSON.stringify(result));

  const indexes: any = await prisma.$runCommandRaw({ listIndexes: 'page_views' });
  console.log('page_views indexes:', JSON.stringify(indexes.cursor?.firstBatch ?? indexes, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
