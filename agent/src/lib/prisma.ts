import { PrismaClient } from '@prisma/client';

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

const prisma = globalForPrisma.prisma;

export async function ensureConnected() {
  await globalForPrisma.prismaConnectPromise;
}

export default prisma;
