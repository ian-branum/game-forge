import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";
import { FREEMIUM } from "@/lib/pricing";

// POST /api/scenarios/[id]/freefix
// Free, self-reported "my game is broken" regenerate. Costs 0 credits.
// Guards: one free fix per scenario, and FREEMIUM.freeFixesPerDay per user per 24h.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check: free fix already used for this scenario
  if (scenario.freeFixUsed) {
    return NextResponse.json({ error: "Free fix already used for this game." }, { status: 402 });
  }

  // Check: per-user daily cap
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fixesToday = await prisma.creditTransaction.count({
    where: { userId, reason: "freeFix", createdAt: { gte: since } },
  });
  if (fixesToday >= FREEMIUM.freeFixesPerDay) {
    return NextResponse.json(
      { error: `Free fix limit reached (${FREEMIUM.freeFixesPerDay} per day).` },
      { status: 402 }
    );
  }

  const serverPlugin = getServerPlugin(scenario.category);
  if (!serverPlugin) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

  // Build chained prompt (same as regenerate route)
  const versions = await prisma.gameVersion.findMany({
    where: { scenarioId: id },
    orderBy: { versionNum: "asc" },
    select: { versionNum: true, prompt: true },
  });

  const chainedPrompt = [
    scenario.prompt,
    ...versions.map((v) => `[Modification ${v.versionNum}]: ${v.prompt}`),
  ].join("\n");

  let payload: unknown;
  try {
    payload = await serverPlugin.generate(chainedPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const nextVersionNum = versions.length > 0 ? versions[versions.length - 1].versionNum + 1 : 1;
  const regenerateLabel = versions.length > 0
    ? `REGENERATE (free fix): ${versions[versions.length - 1].prompt}`
    : `REGENERATE (free fix): ${scenario.prompt}`;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.gameVersion.create({
      data: {
        scenarioId: id,
        versionNum: nextVersionNum,
        prompt: regenerateLabel,
        payload: payload as object,
      },
      select: { id: true, versionNum: true, prompt: true, createdAt: true },
    });

    await tx.scenario.update({
      where: { id },
      data: {
        payload: payload as object,
        activeVersionId: created.id,
        freeFixUsed: true, // mark used — one per scenario
      },
    });

    // Record as $0 transaction so the daily cap query works
    await tx.creditTransaction.create({
      data: { userId, amount: 0, reason: "freeFix" },
    });

    return created;
  });

  return NextResponse.json({ ok: true, version });
}
