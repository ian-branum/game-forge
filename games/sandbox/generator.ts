import { SandboxScenario, SandboxScenarioSchema } from "./schema";

const SYSTEM_PROMPT = `You are a world-class browser game developer. Generate a complete, self-contained HTML file for the requested game.

REQUIREMENTS:
- Single HTML file. All CSS and JavaScript inline. No external dependencies except Google Fonts.
- Google Fonts allowed: import Orbitron via @import in <style> tag.
- Dark theme: background #05071a, primary text #e2e8f0, accent glow #4488ff.
- Use Orbitron font for headings, titles, scores.
- Game canvas or DOM-based board. Responsive — works on mobile and desktop.
- Include an AI/computer opponent where applicable (minimax for simple games, heuristic for complex ones).
- Game must be fully playable: win/lose/draw detection, restart button, score display.
- Glowing visual effects via box-shadow and text-shadow where appropriate.
- Mobile touch controls where applicable (buttons ≥ 44px).
- Clean, modern aesthetic. No browser alerts — use in-page status messages.
- Output ONLY the raw HTML. No markdown. No explanation. No code fences.`;

const MODEL = "deepseek-v4-flash";
const MAX_TOKENS = 16000;
const TEMPERATURE = 0.5;

/** Strip leading/trailing markdown code fences (```html ... ``` / ``` ... ```) from model output. */
function stripFences(text: string): string {
  let out = text.trim();
  // Full-document fence
  const full = out.match(/^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n?```$/);
  if (full) return full[1].trim();
  // Fallback: remove any leading/trailing fence markers
  out = out.replace(/^```[a-zA-Z0-9]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  return out.trim();
}

/** Extract the document title from the <title> tag, falling back to the prompt. */
function extractTitle(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m?.[1]?.trim();
  return t && t.length > 0 ? t : fallback;
}

/** Extract the first sentence of the <meta name="description"> content, with a safe fallback. */
function extractDescription(html: string): string {
  const tag = html.match(/<meta[^>]*name=["']description["'][^>]*>/i)?.[0];
  if (tag) {
    const content = tag.match(/content=["']([\s\S]*?)["']/i)?.[1];
    if (content) {
      const trimmed = content.trim();
      const firstSentence = trimmed.match(/^[^.!?]*[.!?]/)?.[0]?.trim();
      const result = firstSentence ?? trimmed;
      if (result.length > 0) return result;
    }
  }
  return "A custom browser game";
}

/** Retry a thunk exactly once on failure. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

/** Single DeepSeek call that returns the raw model content for an HTML-generation user message. */
async function fetchRawHtml(userMessage: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      // NOTE: no response_format — the output is raw HTML, not JSON.
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      reasoning_effort: "none",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error(`DeepSeek returned no content. Full response: ${JSON.stringify(data)}`);
  }
  return content;
}

/** Fetch + strip fences; retries once if the result is implausibly short. */
async function generateHtml(userMessage: string): Promise<string> {
  return withRetry(async () => {
    const raw = await fetchRawHtml(userMessage);
    const html = stripFences(raw);
    if (html.length < 100) {
      throw new Error("Generated game HTML was too short to be valid");
    }
    return html;
  });
}

/** Generate a complete self-contained game from a natural-language prompt. */
export async function generateSandboxScenario(prompt: string): Promise<SandboxScenario> {
  const html = await generateHtml(`Create a browser game: ${prompt}`);
  return SandboxScenarioSchema.parse({
    title: extractTitle(html, prompt || "Custom Game"),
    description: extractDescription(html),
    html,
  });
}

/** Modify an existing sandbox game, feeding the current HTML back to the model. */
export async function modifySandboxScenario(
  existingHtml: string,
  modificationPrompt: string
): Promise<SandboxScenario> {
  const userMessage =
    `Here is the current game code:\n\n${existingHtml}\n\n` +
    `Modify it as follows: ${modificationPrompt}\n\n` +
    `Output the complete modified HTML file.`;
  const html = await generateHtml(userMessage);
  return SandboxScenarioSchema.parse({
    title: extractTitle(html, extractTitle(existingHtml, "Custom Game")),
    description: extractDescription(html),
    html,
  });
}
