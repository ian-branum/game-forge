import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type LineageNode = { id: string; parentScenarioId: string | null; creator: string };
type LineageRow = {
  id: string;
  parentScenarioId: string | null;
  user: { displayName: string | null; name: string | null } | null;
};

// Walk the parent chain (current → original) and return [{displayName, scenarioId}] original → current.
async function buildLineage(
  startId: string,
  cache: Map<string, LineageNode>
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "newest";
  const q = searchParams.get("q")?.trim();

  const rows = await prisma.scenario.findMany({
    where: {
      isPublic: true,
      isDemo: false,
      archived: false,
      userId: { not: userId },
      ...(category && category !== "all" ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    // "popular" is a TODO — fall back to newest for now.
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      parentScenarioId: true,
      priceToPlay: true,
      priceToClone: true,
      freePlayLimit: true,
      adventureSubtype: true,
      isPublic: true,
      createdAt: true,
      user: { select: { displayName: true, name: true } },
      _count: { select: { versions: true } },
    },
  });

  const ids = rows.map(r => r.id);

  const [plays, licenses] = await Promise.all([
    ids.length
      ? prisma.scenarioPlay.findMany({ where: { userId, scenarioId: { in: ids } } })
      : Promise.resolve([]),
    ids.length
      ? prisma.scenarioLicense.findMany({ where: { userId, scenarioId: { in: ids } } })
      : Promise.resolve([]),
  ]);

  const playByScenario = new Map(plays.map(p => [p.scenarioId, p.count]));
  const licenseByScenario = new Map<string, Set<string>>();
  for (const lic of licenses) {
    const set = licenseByScenario.get(lic.scenarioId) ?? new Set<string>();
    set.add(lic.type);
    licenseByScenario.set(lic.scenarioId, set);
  }

  const lineageCache = new Map<string, LineageNode>();

  const scenarios = await Promise.all(
    rows.map(async row => {
      const trialCount = playByScenario.get(row.id) ?? 0;
      const types = licenseByScenario.get(row.id) ?? new Set<string>();
      const hasPlayLicense = types.has("PLAY");
      const hasCloneLicense = types.has("CLONE");
      const lineage = row.parentScenarioId ? await buildLineage(row.id, lineageCache) : [];

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        creator: row.user?.displayName ?? row.user?.name ?? "Unknown",
        priceToPlay: row.priceToPlay,
        priceToClone: row.priceToClone,
        freePlayLimit: row.freePlayLimit,
        adventureSubtype: row.adventureSubtype,
        isPublic: row.isPublic,
        createdAt: row.createdAt,
        versionCount: row._count.versions,
        lineage,
        userStatus: {
          trialCount,
          hasPlayLicense,
          hasCloneLicense,
          canTrial: !hasPlayLicense && !hasCloneLicense && trialCount < row.freePlayLimit,
        },
      };
    })
  );

  return NextResponse.json({ scenarios, sort });
}
