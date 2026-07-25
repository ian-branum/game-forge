export interface NarrativeChoice {
  text: string;         // the option label (max 60 chars)
  outcome: string;      // what happens if chosen (max 150 chars)
  nextScene: number;    // index into scenes array (-1 = end)
  isGood?: boolean;     // hint for coloring good vs bad choices
}

export interface NarrativeScene {
  id: number;
  text: string;         // scene description (max 300 chars)
  choices: NarrativeChoice[];
  isEnd?: boolean;
  endType?: "victory" | "defeat" | "neutral";
}

export interface NarrativeScenario {
  title: string;
  genre: string;
  opening: string;      // 2-sentence world intro shown before scene 0
  scenes: NarrativeScene[];
}

const SYSTEM_PROMPT = `You are an interactive fiction writer. Create a branching text adventure with exactly 9 scenes.

Output ONLY valid JSON:
{
  "title": string,
  "genre": string,
  "opening": string (2 sentences, max 200 chars, sets the world),
  "scenes": [
    {
      "id": 0,
      "text": string (scene description, max 250 chars),
      "choices": [
        { "text": string (max 50 chars), "outcome": string (max 120 chars), "nextScene": number, "isGood": boolean }
      ],
      "isEnd": false
    }
  ]
}

Structure — exactly 9 scenes with these ids:
- Scene 0: opening scene, 3 choices → scenes 1, 2, 3
- Scene 1: path A mid, 2 choices → scenes 4, 5
- Scene 2: path B mid, 2 choices → scenes 5, 6
- Scene 3: path C mid, 2 choices → scenes 6, 7
- Scene 4: end (victory), isEnd:true, endType:"victory", no choices
- Scene 5: end (defeat), isEnd:true, endType:"defeat", no choices
- Scene 6: end (neutral), isEnd:true, endType:"neutral", no choices
- Scene 7: end (victory), isEnd:true, endType:"victory", no choices
- Scene 8: twist mid (reached from scene 2 or 3), 2 choices → scenes 4, 5

Adjust nextScene references so the graph is connected and makes narrative sense.
Mark isGood:true on choices that lead toward victory, false toward defeat.
Keep all text concise — token budget is tight.`;

export async function generateNarrativeScenario(prompt: string): Promise<NarrativeScenario> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Write a branching text adventure set in: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`DeepSeek returned no content: ${JSON.stringify(data)}`);

  let raw: NarrativeScenario;
  try { raw = JSON.parse(rawContent); }
  catch (e) { throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`); }

  if (!raw.scenes?.length) throw new Error("DeepSeek returned no scenes");
  return raw;
}
