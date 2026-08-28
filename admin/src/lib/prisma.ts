import { PrismaClient } from '@prisma/client';
import { withSoftDelete } from './softDelete';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaRaw: PrismaClient;
};

function createPrismaClient() {
  const client = new PrismaClient();
  client.$connect().catch((err) => {
    console.error('Prisma failed to connect:', err);
  });
  return client;
}

const basePrisma = globalForPrisma.prismaRaw ?? createPrismaClient();

/**
 * The default client hides soft-deleted rows and turns deletes into stamps.
 * See lib/softDelete.ts.
 */
const prisma = withSoftDelete(basePrisma);

/**
 * Unfiltered client. Use only where deleted rows are the point — restore flows,
 * the audit trail, and maintenance scripts.
 */
export const prismaRaw = basePrisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaRaw = basePrisma;
  globalForPrisma.prisma = prisma as unknown as PrismaClient;
}

export default prisma;
