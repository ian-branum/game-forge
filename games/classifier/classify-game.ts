import type { ClassificationResult } from "@/games/shared/types";

const SYSTEM_PROMPT = `You are a game-type classifier for a browser game platform. Given a user's natural-language description, classify it into the most appropriate game type and architectural profile.

Available game types:
- trivia: Quiz/question-answer games on any topic. No opponent. Challenge format.
- sandbox: Custom board/strategy games vs an AI opponent, generated on demand. Any game, any variant (Chess, Checkers, Othello, Connect 4, or custom variants with non-standard boards/pieces). Turn-based.
- solitaire: Single-player card games. No opponent.
- tactical: Hex-grid squad combat with AI opponent. Turn-based.
- opposed-card: Card battle against an AI opponent.
- adventure: Branching narrative / text adventure. No real-time opponent.

Output ONLY valid JSON matching this schema exactly:
{
  "gameType": string,
  "profile": {
    "interaction": "challenge" | "opposed" | "cooperative" | "narrative" | "sandbox" | "social",
    "turnModel": "question-sequence" | "turn-based" | "phase-based" | "tick-based" | "real-time",
    "runtimeIntelligence": "none" | "scripted" | "search-based" | "simulation-based" | "generative" | "hybrid",
    "information": "perfect" | "partial" | "hidden",
    "playerCount": number,
    "persistence": "none" | "session" | "campaign"
  },
  "confidence": number,
  "assumptions": string[],
  "clarificationNeeded": string | null
}

Rules:
- confidence < 0.75 AND a different game type would substantially change the experience: set clarificationNeeded to a single focused question
- confidence >= 0.75: set clarificationNeeded to null
- assumptions: list any inferences made about missing info`;

export async function classifyGame(prompt: string): Promise<ClassificationResult> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 512,
      reasoning_effort: "none",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Classifier API error ${response.status}: ${err}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  const raw = JSON.parse(data.choices[0].message.content) as ClassificationResult;
  return raw;
}
