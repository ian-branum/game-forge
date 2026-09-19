import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    const playSelect = {
      id: true,
      title: true,
      description: true,
      category: true,
      createdAt: true,
      user: { select: { displayName: true, name: true } },
    } as const;

    const mine = await prisma.scenario.findMany({
      where: { userId, archived: false },
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
          where: { id: { in: licensedIds }, archived: false },
          orderBy: { createdAt: "desc" },
          select: playSelect,
        })
      : [];

    const scenarios = [...mine, ...licensed].map(({ user, ...rest }) => ({
      ...rest,
      creator: user?.displayName ?? user?.name ?? "Unknown",
    }));

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
