import { prisma } from "@/lib/prisma";

export type LineageNode = {
  id: string;
  parentScenarioId: string | null;
  creator: string;
};

type LineageRow = {
  id: string;
  parentScenarioId: string | null;
  user: { displayName: string | null; name: string | null } | null;
};

/**
 * Walk the parent chain (current → original) and return the lineage as
 * [{ displayName, scenarioId }] ordered original → current.
 *
 * Shared by the marketplace and play-tab endpoints. Pass a shared `cache`
 * Map when resolving many scenarios in one request to avoid repeat queries.
 */
export async function buildLineage(
  startId: string,
  cache: Map<string, LineageNode> = new Map()
): Promise<Array<{ displayName: string; scenarioId: string }>> {
  const chain: Array<{ displayName: string; scenarioId: string }> = [];
  const seen = new Set<string>();
  let currentId: string | null = startId;

  while (currentId && !seen.has(currentId) && chain.length < 20) {
    seen.add(currentId);
    let node = cache.get(currentId);
    if (!node) {
      const row: LineageRow | null = await prisma.scenario.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          parentScenarioId: true,
          user: { select: { displayName: true, name: true } },
        },
      });
      if (!row) break;
      node = {
        id: row.id,
        parentScenarioId: row.parentScenarioId,
        creator: row.user?.displayName ?? row.user?.name ?? "Unknown",
      };
      cache.set(currentId, node);
    }
    chain.unshift({ displayName: node.creator, scenarioId: node.id });
    currentId = node.parentScenarioId;
  }

  return chain;
}
