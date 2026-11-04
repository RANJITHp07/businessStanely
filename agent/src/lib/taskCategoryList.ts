import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Search conditions for a task category list: name, description, or the name of
 * whoever created it (and deleted it, on the deleted list). People are looked up
 * first so the category query itself needs no join.
 */
export async function categorySearchConditions(
  search: string,
  { includeDeleter = false } = {},
): Promise<Prisma.TaskCategoryWhereInput[]> {
  const contains = { contains: search, mode: "insensitive" as const };
  const [users, agents] = await Promise.all([
    prisma.user.findMany({ where: { username: contains }, select: { id: true } }),
    prisma.agent.findMany({ where: { name: contains }, select: { id: true } }),
  ]);
  const userIds = users.map((user) => user.id);
  const agentIds = agents.map((agent) => agent.id);

  return [
    { name: contains },
    { description: contains },
    { createdByUserId: { in: userIds } },
    { createdByAgentId: { in: agentIds } },
    ...(includeDeleter ? [{ deletedById: { in: [...userIds, ...agentIds] } }] : []),
  ];
}

/** Reads `page` and `limit` from a list request. */
export function parsePagination(params: URLSearchParams) {
  const page = Math.max(parseInt(params.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "20", 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}
