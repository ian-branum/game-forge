export type Suit = "♠" | "♥" | "♦" | "♣";
export type CardValue = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface PlayingCard {
  suit: Suit;
  value: CardValue;
}

export interface SolitaireScenario {
  title: string;
  theme: string;
  flavour: string;        // 1-2 sentence thematic intro
  variant: "klondike" | "freecell" | "pyramid";
  rules: string[];        // bullet-point rules as strings
  // For pyramid: triangle of 28 cards (rows 1-7)
  // For klondike: 7 tableau piles + 4 foundation + stock
  // For freecell: 8 columns
  deck: PlayingCard[];    // ordered deck to deal from (all 52 or subset)
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES: CardValue[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function shuffledDeck(seed: number): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value });

  // Seeded Fisher-Yates
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const SYSTEM_PROMPT = `You are a card game designer. Given a theme, design a thematic solitaire card game.

Output ONLY valid JSON:
{
  "title": string,
  "theme": string,
  "flavour": string (1 sentence, max 100 chars),
  "variant": "klondike" | "freecell" | "pyramid",
  "rules": string[] (exactly 4 bullet-point rules describing the variant clearly, max 80 chars each)
}

Choose the variant that best fits the theme:
- klondike: classic tableau stacking, good for most themes
- freecell: all cards visible, strategic, good for mystery/detective themes
- pyramid: pair cards to 13, good for ancient/history themes

Keep the rules accurate to the chosen variant.`;

export async function generateCardScenario(prompt: string): Promise<SolitaireScenario> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a thematic solitaire card game about: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`DeepSeek returned no content: ${JSON.stringify(data)}`);

  let raw: Omit<SolitaireScenario, "deck">;
  try { raw = JSON.parse(rawContent); }
  catch (e) { throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`); }

  // Generate a deterministic shuffled deck based on current timestamp (unique per game)
  const seed = Date.now() & 0xffffff;
  const deck = shuffledDeck(seed);

  return { ...raw, deck };
}
