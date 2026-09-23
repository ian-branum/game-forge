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
3. DEAD INPUT: Click/keydown/touchstart handlers not attached, or attached to the wrong element
4. INVISIBLE PIECES: Game state initialised but draw() never called on first load
5. SILENT CRASH: Obvious JS errors that would throw on init (undefined variable, missing function call)
6. MISSING INIT: Game setup function defined but never called

Do NOT flag style issues, performance concerns, missing features, or anything that works but could be better.

Respond in this exact JSON format (no markdown, no preamble):
{"pass": true}
or
{"pass": false, "issues": ["brief description of issue 1"]}`;

async function runQACheck(html: string): Promise<{ pass: boolean; issues?: string[] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { pass: true };

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

    if (!response.ok) return { pass: true };
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { pass: true };
    const result = JSON.parse(content);
    return { pass: result.pass === true, issues: result.issues ?? [] };
  } catch {
    return { pass: true };
  }
}

// ─── SSE helper ─────────────────────────────────────────────────────────────
// Lets the generation path push mid-request messages (e.g. "retrying…") to the
// client without a full streaming rewrite of the response.
function sseStream(handler: (send: (event: string, data: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await handler(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
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

  const userId = session.user.id;

  // ── Generation path (SSE) ────────────────────────────────────────────────
  return sseStream(async (send) => {
    try {
      // First attempt
      let payload = await plugin.generate(prompt);
      plugin.validate(payload);
      const title = (payload as { title?: string }).title ?? "Untitled";
      const html = (payload as { html?: string }).html;

      let [description, qaResult] = await Promise.all([
        generateDescription(prompt, title, gameType),
        html ? runQACheck(html) : Promise.resolve<{ pass: boolean; issues?: string[] }>({ pass: true }),
      ]);

      // If QA fails, retry once — tell the user why they're waiting.
      if (!qaResult.pass) {
        console.warn("[/api/generate] QA failed, retrying:", qaResult.issues);
        send("status", {
          message: "My first attempt wasn't great. Let me try again — hang in there! 🛠️",
        });

        payload = await plugin.generate(prompt);
        plugin.validate(payload);
        const title2 = (payload as { title?: string }).title ?? "Untitled";
        const html2 = (payload as { html?: string }).html;

        [description, qaResult] = await Promise.all([
          generateDescription(prompt, title2, gameType),
          html2 ? runQACheck(html2) : Promise.resolve<{ pass: boolean; issues?: string[] }>({ pass: true }),
        ]);

        // If the second attempt also fails, proceed anyway (fail open — better a
        // potentially imperfect game than a dead end for the user).
        if (!qaResult.pass) {
          console.warn("[/api/generate] QA failed on retry too, proceeding anyway:", qaResult.issues);
        }
      }

      const finalTitle = (payload as { title?: string }).title ?? "Untitled";

      const [scenario] = await prisma.$transaction([
        prisma.scenario.create({
          data: {
            userId,
            category: gameType,
            title: finalTitle,
            description,
            prompt,
            payload: payload as object,
          },
        }),
        prisma.user.update({ where: { id: userId }, data: { credits: { decrement: cost } } }),
        prisma.creditTransaction.create({ data: { userId, amount: -cost, reason: "generation" } }),
      ]);

      send("done", { id: scenario.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("[/api/generate] Generation failed:", msg, stack);
      send("done", { error: msg, stack });
    }
  });
}
