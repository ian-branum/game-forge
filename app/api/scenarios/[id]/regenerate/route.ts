import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";
import { getCost } from "@/lib/pricing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serverPlugin = getServerPlugin(scenario.category);
  if (!serverPlugin) {
    return NextResponse.json({ error: `Unknown category: ${scenario.category}` }, { status: 400 });
  }

  const cost = getCost("regenerate", scenario.category);
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.credits < cost) {
    return NextResponse.json(
      { error: "Insufficient credits", needed: cost, have: user?.credits ?? 0 },
      { status: 402 }
    );
  }

  // Build the full prompt chain: original prompt + all version modify prompts (asc)
  const versions = await prisma.gameVersion.findMany({
    where: { scenarioId: id },
    orderBy: { versionNum: "asc" },
    select: { versionNum: true, prompt: true },
  });

  const chainedPrompt = [
    scenario.prompt,
    ...versions.map((v) => `[Modification ${v.versionNum}]: ${v.prompt}`),
  ].join("\n");

  // Re-run the generator with the chained prompts only (no existing code)
  let payload: unknown;
  try {
    payload = await serverPlugin.generate(chainedPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/scenarios/regenerate] Generation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const nextVersionNum =
    versions.length > 0 ? versions[versions.length - 1].versionNum + 1 : 1;

  // The prompt stored for a regeneration describes what was regenerated from
  const regenerateLabel =
    versions.length > 0
      ? `REGENERATE: ${versions[versions.length - 1].prompt}`
      : `REGENERATE: ${scenario.prompt}`;

  const userId = session.user.id;

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
      data: { payload: payload as object, activeVersionId: created.id },
    });

    await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    });

    await tx.creditTransaction.create({
      data: { userId, amount: -cost, reason: "regenerate" },
    });

    return created;
  });

  return NextResponse.json({ ok: true, version });
}
