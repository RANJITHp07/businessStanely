import prisma from "@/lib/prisma";

/**
 * Whether every target agent sits below `viewerId` in the team tree, at any
 * depth, matching what /api/team-members lists. Stops once all are found.
 */
export async function isSuperiorOfAll(viewerId: string, targetIds: string[]) {
  const remaining = new Set(targetIds);
  const visited = new Set<string>([viewerId]);
  let frontier = [viewerId];

  while (frontier.length > 0 && remaining.size > 0) {
    const links = await prisma.agentSuperior.findMany({
      where: { superiorId: { in: frontier } },
      select: { subordinateId: true },
    });

    const next: string[] = [];
    for (const { subordinateId } of links) {
      remaining.delete(subordinateId);
      if (!visited.has(subordinateId)) {
        visited.add(subordinateId);
        next.push(subordinateId);
      }
    }
    frontier = next;
  }

  return remaining.size === 0;
}
