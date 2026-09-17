import { SandboxScenario, SandboxScenarioSchema } from "./schema";

const SYSTEM_PROMPT = `You are a world-class browser game developer. Generate a complete, self-contained HTML file for the requested game.

CRITICAL OUTPUT RULE: Output ONLY the raw HTML document, starting with <!DOCTYPE html>. Absolutely no preamble, explanation, markdown, or code fences. The very first character of your response must be '<'.

LAYOUT — follow this exactly:
- <body> uses flexbox column: display:flex; flex-direction:column; align-items:center; justify-content:flex-start; min-height:100vh; margin:0; padding:16px; box-sizing:border-box;
- Section order (top to bottom, all centered):
  1. TITLE — large Orbitron heading with glow, score/status line below it
  2. GAME BOARD — canvas or grid, centered, max-width fits viewport
  3. CONTROLS — restart/undo buttons, centered
  4. INSTRUCTIONS — short paragraph(s), centered, max-width 600px, smaller font

STYLE REQUIREMENTS:
- Background: #05071a (full page). Primary text: #e2e8f0.
- Orbitron font (import via @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap')).
- Accent glow color: #4488ff. Use box-shadow and text-shadow for glow effects.
- Buttons: min-height 44px, Orbitron font, dark bg with blue glow border.
- No horizontal scrollbar. Game must fit within 100vw at all screen sizes.
- Status messages in-page only — no browser alerts or confirm() dialogs.

GAME REQUIREMENTS:
- Fully playable: win/lose/draw detection, restart, score display.
- AI/computer opponent where applicable (minimax for simple games, heuristic for complex).
- Touch-friendly (tap targets ≥ 44px on mobile).
- Include a <title> tag with the game name and a <meta name="description"> tag.`;


const MODEL = "deepseek-v4-flash";
const MAX_TOKENS = 16000;
const TEMPERATURE = 0.5;

/** Strip preamble text and markdown code fences; extract raw HTML starting with <!DOCTYPE or <html. */
function stripFences(text: string): string {
  const out = text.trim();

  // If there's a ```html or ``` fence, extract content between the first opening and last closing fence.
  const fenceOpen = out.search(/```[a-zA-Z0-9]*\s*\n/);
  if (fenceOpen !== -1) {
    const afterOpen = out.slice(fenceOpen).replace(/^```[a-zA-Z0-9]*\s*\n/, "");
    const fenceClose = afterOpen.lastIndexOf("```");
    const inner = fenceClose !== -1 ? afterOpen.slice(0, fenceClose) : afterOpen;
    return inner.trim();
  }

  // No fences: find the first < to discard any leading preamble text.
  const htmlStart = out.indexOf("<!DOCTYPE");
  if (htmlStart !== -1) return out.slice(htmlStart).trim();
  const htmlTagStart = out.indexOf("<html");
  if (htmlTagStart !== -1) return out.slice(htmlTagStart).trim();

  // Last resort: return as-is
  return out;
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
