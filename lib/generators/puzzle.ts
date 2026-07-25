export interface LogicClue {
  text: string;
}

export interface LogicPuzzle {
  title: string;
  topic: string;
  intro: string;
  categories: [string[], string[], string[]]; // 3 categories, each with 4 items
  solution: number[][];                         // solution[i][j] = true/false as 1/0, 4x4 grid (cat0 vs cat2)
  clues: LogicClue[];
}

const SYSTEM_PROMPT = `You are a logic grid puzzle designer. Create a 4×4 logic grid puzzle with 3 categories of 4 items each.

A logic grid puzzle: given clues, deduce which item from category A matches which item from category C.

Output ONLY valid JSON:
{
  "title": string,
  "topic": string,
  "intro": string (1 sentence scene-setter, max 80 chars),
  "categories": [
    ["ItemA1","ItemA2","ItemA3","ItemA4"],
    ["ItemB1","ItemB2","ItemB3","ItemB4"],
    ["ItemC1","ItemC2","ItemC3","ItemC4"]
  ],
  "solution": [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],
  "clues": [
    {"text": "clue statement 1 (max 100 chars)"},
    {"text": "clue statement 2"},
    {"text": "clue statement 3"},
    {"text": "clue statement 4"},
    {"text": "clue statement 5"},
    {"text": "clue statement 6"}
  ]
}

Rules:
- solution is a 4x4 boolean matrix where solution[i][j]=1 means category[0][i] matches category[2][j]
- Each row and column in solution must have exactly one 1 (it's a permutation)
- Clues must be logically sufficient to deduce the full solution
- Items in each category must be distinct, thematic, and short (max 20 chars)
- Write exactly 6 clues using positive and negative statements ("X is not Y", "X is paired with Y", "X is ranked higher than Y")`;

export async function generateLogicPuzzle(prompt: string): Promise<LogicPuzzle> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a logic grid puzzle themed around: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`DeepSeek returned no content: ${JSON.stringify(data)}`);

  let raw: LogicPuzzle;
  try { raw = JSON.parse(rawContent); }
  catch (e) { throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`); }

  return raw;
}
