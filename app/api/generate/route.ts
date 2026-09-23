import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";

const DESCRIPTION_MODEL = "deepseek-v4-flash";

const DESCRIPTION_SYSTEM_PROMPT =
  "You are a game curator. Write 2–3 punchy sentences (max 300 characters total) describing this game for a marketplace listing. Cover: what type of game it is, what makes it interesting or unique, and what the player does. No preamble, no quotes — just the sentences.";

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
        max_tokens: 160,
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

// ─── QA gate ────────────────────────────────────────────────────────────────
// A DeepSeek-backed code review of freshly generated game HTML. Runs in parallel
// with description generation, so it adds zero wall-clock time for the user.
// Fails OPEN: infrastructure problems never block game creation.

const QA_MODEL = "deepseek-v4-flash";

const QA_SYSTEM_PROMPT = `You are a senior browser game QA engineer. You will be given the full HTML source of a self-contained browser game. Your job is to identify bugs that would cause the game to be visually broken or unplayable on first load.

Check specifically for:
1. BLANK RENDER: Canvas element present but getContext('2d') never called, or canvas dimensions are 0
2. DEAD LOOP: Game loop (requestAnimationFrame or setInterval) never started, or only starts on an event that hasn't fired
3. DEAD INPUT: Click/keydown/touchstart handlers not attached, or attached to the wrong element (e.g. document instead of canvas, or vice versa)
4. INVISIBLE PIECES: Game state initialised but draw() never called on first load (pieces exist in memory but never painted)
5. SILENT CRASH: Obvious JS errors that would throw on init (undefined variable, missing function call, wrong property name)
6. MISSING INIT: Game setup function defined but never called

Do NOT flag:
- Style preferences or minor cosmetic issues
- Performance concerns
- Missing features
- Anything that works but could be done better

Respond in this exact JSON format (no markdown, no preamble):
{"pass": true}
or
{"pass": false, "issues": ["brief description of issue 1", "brief description of issue 2"]}`;

async function runQACheck(html: string): Promise<{ pass: boolean; issues?: string[] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { pass: true }; // fail open if no key

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: QA_MODEL,
        messages: [
          { role: "system", content: QA_SYSTEM_PROMPT },
          { role: "user", content: `Review this game HTML:\n\n${html}` },
        ],
        temperature: 0,
        max_tokens: 200,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return { pass: true }; // fail open on API error

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { pass: true };

    const result = JSON.parse(content);
    return {
      pass: result.pass === true,
      issues: result.issues ?? [],
    };
  } catch {
    return { pass: true }; // fail open on any error
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

  // Run description generation and the QA code review concurrently — QA costs
  // no extra wall-clock time since description generation already takes a few
  // seconds. Only sandbox games carry `payload.html`, so other types skip QA.
  const html = (payload as { html?: string }).html;

  const [description, qaResult] = await Promise.all([
    generateDescription(prompt, title, gameType),
    html ? runQACheck(html) : Promise.resolve<{ pass: boolean; issues?: string[] }>({ pass: true }),
  ]);

  if (!qaResult.pass) {
    console.error("[/api/generate] QA failed:", qaResult.issues);
    return NextResponse.json(
      {
        error: "Game generation failed QA check — the game may not render correctly.",
        issues: qaResult.issues,
      },
      { status: 500 }
    );
  }

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
