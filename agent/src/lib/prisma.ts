import { PrismaClient } from '@prisma/client';
import { withSoftDelete } from './softDelete';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaConnectPromise: Promise<void>;
};

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient();
  globalForPrisma.prismaConnectPromise = globalForPrisma.prisma.$connect().catch((err) => {
    console.error('Prisma failed to connect:', err);
  });
}

/**
 * Unfiltered client. Use only where deleted rows are the point — restore flows,
 * the audit trail, and maintenance scripts.
 */
export const prismaRaw = globalForPrisma.prisma;

/**
 * The default client hides soft-deleted rows and turns deletes into stamps.
 * See lib/softDelete.ts.
 */
const prisma = withSoftDelete(globalForPrisma.prisma);

export async function ensureConnected() {
  await globalForPrisma.prismaConnectPromise;
}

export default prisma;
