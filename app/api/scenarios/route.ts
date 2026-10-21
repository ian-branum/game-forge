import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildLineage, type LineageNode } from "@/lib/lineage";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");

  // ── PLAY tab: everything I can play = my own games ∪ originals I hold a license for ──
  if (mode === "play") {
    const playCategory = searchParams.get("category");
    const categoryFilter = playCategory && playCategory !== "all" ? { category: playCategory } : {};

    const playSelect = {
      id: true,
      title: true,
      description: true,
      category: true,
      parentScenarioId: true,
      createdAt: true,
      user: { select: { displayName: true, name: true } },
    } as const;

    const mine = await prisma.scenario.findMany({
      where: { userId, archived: false, deepArchived: false, ...categoryFilter },
      orderBy: { createdAt: "desc" },
      select: playSelect,
    });

    const licenses = await prisma.scenarioLicense.findMany({
      where: { userId },
      select: { scenarioId: true },
    });
    const mineIds = new Set(mine.map(s => s.id));
    const licensedIds = [...new Set(licenses.map(l => l.scenarioId))].filter(id => !mineIds.has(id));

    const licensed = licensedIds.length
      ? await prisma.scenario.findMany({
          where: { id: { in: licensedIds }, archived: false, deepArchived: false, ...categoryFilter },
          orderBy: { createdAt: "desc" },
          select: playSelect,
        })
      : [];

    const lineageCache = new Map<string, LineageNode>();

    // Fetch originalScenarioId for all "mine" rows so we can deduplicate.
    const mineWithOrigin = mine.length
      ? await prisma.scenario.findMany({
          where: { id: { in: mine.map(s => s.id) } },
          select: { id: true, originalScenarioId: true },
        })
      : [];
    const myOriginalIds = new Set(
      mineWithOrigin.map(s => s.originalScenarioId).filter(Boolean) as string[]
    );

    // If I own a fork of a game I also hold a license for, show only the fork.
    const deduplicatedLicensed = licensed.filter(s => !myOriginalIds.has(s.id));

    const scenarios = await Promise.all(
      [...mine, ...deduplicatedLicensed].map(async ({ user, ...rest }) => ({
        ...rest,
        creator: user?.displayName ?? user?.name ?? "Unknown",
        lineage: rest.parentScenarioId ? await buildLineage(rest.id, lineageCache) : [],
      }))
    );

    return NextResponse.json({ scenarios, currentUserId: userId });
  }

  // ── BUILD tab: my own scenarios (default) ──
  const archived = searchParams.get("archived") === "true";
  const category = searchParams.get("category"); // null = all

  const rows = await prisma.scenario.findMany({
    where: {
      // Build is always scoped to the current user's own created scenarios.
      userId,
      archived: archived ? true : false,
      // Deep-archived games are invisible everywhere, including the archive view.
      deepArchived: false,
      ...(category && category !== "all" ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      category: true,
      prompt: true,
      isPublic: true,
      isClonable: true,
      clonesMayRepublish: true,
      priceToPlay: true,
      priceToClone: true,
      activeVersionId: true,
      archived: true,
      freePlayLimit: true,
      adventureSubtype: true,
      freeFixUsed: true,
      versions: {
        select: { id: true, versionNum: true, prompt: true, createdAt: true },
        orderBy: { versionNum: "asc" },
      },
      user: {
        select: { displayName: true, name: true },
      },
      createdAt: true,
    },
  });

  // Strip the raw user object; expose a resolved creator display name instead.
  const scenarios = rows.map(({ user, ...rest }) => ({
    ...rest,
    creator: user?.displayName ?? user?.name ?? "Unknown",
  }));

  return NextResponse.json({ scenarios, currentUserId: userId });
}
