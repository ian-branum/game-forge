import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";

const DESCRIPTION_MODEL = "deepseek-v4-flash";

const DESCRIPTION_SYSTEM_PROMPT =
  "You are a game curator. Write a single punchy sentence (max 120 characters) describing this game for a marketplace listing. No preamble, no quotes, just the sentence.";

/**
 * Generate a short, punchy marketplace description for a freshly forged game.
 * Falls back to a truncated prompt if the model is unavailable or fails.
 */
async function generateDescription(prompt: string, title: string, gameType: string): Promise<string> {
  const fallback = prompt.slice(0, 120) + (prompt.length > 120 ? "…" : "");

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return fallback;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DESCRIPTION_MODEL,
        messages: [
          { role: "system", content: DESCRIPTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Game type: ${gameType}. Title: "${title}". Created from prompt: "${prompt}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 80,
        reasoning_effort: "none",
      }),
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback;

    const text = content.trim().replace(/^["']+|["']+$/g, "").trim();
    return text.length > 0 ? text.slice(0, 300) : fallback;
  } catch {
    return fallback;
  }
}

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

  const title = (payload as { title?: string }).title ?? "Untitled";
  const description = await generateDescription(prompt, title, gameType);

  const [scenario] = await prisma.$transaction([
    prisma.scenario.create({
      data: {
        userId: session.user.id,
        category: gameType,
        title,
        description,
        prompt,
        payload: payload as object,
      },
    }),
    prisma.user.update({ where: { id: session.user.id }, data: { credits: { decrement: cost } } }),
    prisma.creditTransaction.create({ data: { userId: session.user.id, amount: -cost, reason: "generation" } }),
  ]);

  return NextResponse.json({ id: scenario.id });
}
