import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildLineage, type LineageNode } from "@/lib/lineage";

// GET /api/marketplace
// Browse other people's PUBLIC, non-archived, non-demo games.
// Games the viewer already bought or cloned are excluded — they live in the Play tab.
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
  const creator = searchParams.get("creator")?.trim();

  // Games the viewer already has access to (bought or cloned) must NOT appear in Buy.
  const ownedLicenses = await prisma.scenarioLicense.findMany({
    where: { userId },
    select: { scenarioId: true },
  });
  const ownedIds = [...new Set(ownedLicenses.map(l => l.scenarioId))];

  const rows = await prisma.scenario.findMany({
    where: {
      isPublic: true,
      archived: false,
      userId: { not: userId },
      id: { notIn: ownedIds },
      ...(category && category !== "all" ? { category } : {}),
      ...(creator
        ? {
            user: {
              OR: [
                { displayName: { equals: creator, mode: "insensitive" as const } },
                { name: { equals: creator, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
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
      isClonable: true,
      clonesMayRepublish: true,
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
        isClonable: row.isClonable,
        clonesMayRepublish: row.clonesMayRepublish,
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
