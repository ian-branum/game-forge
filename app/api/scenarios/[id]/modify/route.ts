import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const modificationPrompt =
    typeof body?.modificationPrompt === "string" ? body.modificationPrompt.trim() : "";
  if (!modificationPrompt) {
    return NextResponse.json({ error: "modificationPrompt must be a non-empty string" }, { status: 400 });
  }

  // Only the owner can modify their own scenario
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Credit check — cost comes from the plugin registry
  const serverPlugin = getServerPlugin(scenario.category);
  if (!serverPlugin) {
    return NextResponse.json({ error: `Unknown category: ${scenario.category}` }, { status: 400 });
  }
  const cost = serverPlugin.meta.creditCost;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.credits < cost) {
    return NextResponse.json(
      { error: "Insufficient credits", needed: cost, have: user?.credits ?? 0 },
      { status: 402 }
    );
  }

  // Fetch all existing versions (ascending) to build the chained prompt
  const versions = await prisma.gameVersion.findMany({
    where: { scenarioId: id },
    orderBy: { versionNum: "asc" },
    select: { versionNum: true, prompt: true },
  });

  const chainedPrompt = [
    ...versions.map((v) => `[Version ${v.versionNum}]: ${v.prompt}`),
    `[Modification]: ${modificationPrompt}`,
  ].join("\n");

  // Run the generator via the plugin registry
  let payload: unknown;
  try {
    payload = await serverPlugin.generate(chainedPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[/api/scenarios/modify] Generation failed:", msg, stack);
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }

  // Next version number = one past the highest existing (handles gaps after deletions)
  const nextVersionNum =
    versions.length > 0 ? versions[versions.length - 1].versionNum + 1 : 1;

  const userId = session.user.id;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.gameVersion.create({
      data: {
        scenarioId: id,
        versionNum: nextVersionNum,
        prompt: modificationPrompt,
        payload: payload as object,
      },
      select: { id: true, versionNum: true, prompt: true, createdAt: true },
    });

    // New version becomes active; keep scenario.payload in sync (play page reads it)
    await tx.scenario.update({
      where: { id },
      data: { payload: payload as object, activeVersionId: created.id },
    });

    await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -cost,
        reason: "modification",
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, version });
}
