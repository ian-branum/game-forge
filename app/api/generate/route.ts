import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { prompt?: string; gameType?: string; category?: string };
  const { prompt } = body;

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  // Support both `gameType` (new) and `category` (legacy field name from the forge UI)
  const gameType = body.gameType ?? body.category;
  if (!gameType) {
    return NextResponse.json({ error: "Missing gameType" }, { status: 400 });
  }

  const plugin = getServerPlugin(gameType);
  if (!plugin) {
    return NextResponse.json({ error: `Unknown game type: ${gameType}` }, { status: 400 });
  }

  const cost = plugin.meta.creditCost;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.credits < cost) {
    return NextResponse.json({ error: "Insufficient credits", needed: cost, have: user?.credits ?? 0 }, { status: 402 });
  }

  let payload: unknown;
  try {
    payload = await plugin.generate(prompt);
    plugin.validate(payload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[/api/generate] Generation failed:", msg, stack);
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }

  const [scenario] = await prisma.$transaction([
    prisma.scenario.create({
      data: {
        userId: session.user.id,
        category: gameType,
        title: (payload as { title?: string }).title ?? "Untitled",
        prompt,
        payload: payload as object,
      },
    }),
    prisma.user.update({ where: { id: session.user.id }, data: { credits: { decrement: cost } } }),
    prisma.creditTransaction.create({ data: { userId: session.user.id, amount: -cost, reason: "generation" } }),
  ]);

  return NextResponse.json({ id: scenario.id });
}
