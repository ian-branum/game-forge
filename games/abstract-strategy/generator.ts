import type { AbstractStrategyScenario } from "./schema";
import { AbstractStrategyScenarioSchema } from "./schema";

// Only known, hand-implemented games are supported for now — we do not
// dynamically generate abstract strategy game engines.
const KNOWN_GAMES = ["othello", "chess"] as const;
type KnownGameId = typeof KNOWN_GAMES[number];

const SYSTEM_PROMPT = `You are an abstract strategy game designer. Given a user's request, pick the best supported game and classify its opponent AI mode.

Supported games (you MUST pick exactly one of these):
- "othello": 8×8 Reversi/Othello. Classic disc-flipping game.
- "chess": standard chess.

If the request does not clearly match one of the supported games, set "gameId" to null.

Opponent mode criteria:
- "algorithmic": small state space, minimax searchable to depth 4+ in < 200ms, well-known evaluation function (Othello, Connect 4, Checkers, Tic-tac-toe).
- "llm-opponent": complex evaluation requiring strategic intuition or branching factor too large (Chess, Go, Shogi, novel/unknown games).

Output ONLY valid JSON:
{
  "gameId": "othello" | "chess" | null,
  "opponentMode": "algorithmic" | "llm-opponent",
  "title": string,
  "description": string (1 sentence, max 100 chars),
  "variant": string | null,
  "aiPersonality": string | null
}

Guidance:
- Othello → opponentMode "algorithmic"; Chess → opponentMode "llm-opponent".
- "variant": for llm-opponent games this may be an opening state or rules variant (e.g. "standard"); null if none.
- "aiPersonality": short flavour for the LLM opponent prompt (e.g. "aggressive", "defensive", "positional"); null if none.`;

interface RawScenario {
  gameId: string | null;
  opponentMode: string;
  title: string;
  description: string;
  variant?: string | null;
  aiPersonality?: string | null;
}

export async function generateAbstractStrategyScenario(prompt: string): Promise<AbstractStrategyScenario> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Design an abstract strategy game for: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 1024,
      reasoning_effort: "none",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`DeepSeek returned no content: ${JSON.stringify(data)}`);

  let raw: RawScenario;
  try { raw = JSON.parse(rawContent); }
  catch (e) { throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`); }

  if (!raw.gameId || !(KNOWN_GAMES as readonly string[]).includes(raw.gameId)) {
    throw new Error(
      `Unsupported abstract strategy game: ${raw.gameId ?? "(none)"}. Supported games: ${KNOWN_GAMES.join(", ")}.`,
    );
  }

  const result: AbstractStrategyScenario = {
    gameId: raw.gameId as KnownGameId,
    title: raw.title,
    description: raw.description,
    opponentMode: raw.opponentMode as AbstractStrategyScenario["opponentMode"],
    variant: raw.variant ?? undefined,
    aiPersonality: raw.aiPersonality ?? undefined,
  };

  return AbstractStrategyScenarioSchema.parse(result);
}
