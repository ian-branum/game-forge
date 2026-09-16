import { Suit, CardValue, PlayingCard, SolitaireScenario, SolitaireScenarioSchema } from "./schema";

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

const SYSTEM_PROMPT = `You are a card game designer. Given a theme, first decide whether the request is for a SOLITAIRE game or an OPPOSED (two-player, vs an opponent) card game.

Output ONLY valid JSON:
{
  "cardMode": "solitaire" | "opposed",
  "title": string,
  "theme": string,
  "flavour": string (1 sentence, max 100 chars),
  "variant": "klondike" | "freecell" | "pyramid" | null,
  "rules": string[] | null
}

Detection:
- "solitaire": single-player patience games (klondike, freecell, pyramid, etc.) that you solve alone.
- "opposed": games where the player plays against an opponent (Spades, Hearts, Rummy, Poker, Euchre, etc.).

For "solitaire":
- Choose the variant that best fits the theme:
  - klondike: classic tableau stacking, good for most themes
  - freecell: all cards visible, strategic, good for mystery/detective themes
  - pyramid: pair cards to 13, good for ancient/history themes
- Provide "rules": exactly 4 bullet-point rules describing the variant clearly, max 80 chars each. Keep them accurate to the chosen variant.

For "opposed":
- Set "variant" to null and "rules" to null. We do not yet implement opposed card games — just give a thematic "title" and "theme" and a "flavour" line.`;

interface RawCardScenario {
  cardMode?: string;
  title?: string;
  theme?: string;
  flavour?: string;
  variant?: "klondike" | "freecell" | "pyramid" | null;
  rules?: string[] | null;
}

export async function generateCardScenario(prompt: string): Promise<SolitaireScenario> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a thematic card game about: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4096,
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

  let raw: RawCardScenario;
  try { raw = JSON.parse(rawContent); }
  catch (e) { throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`); }

  // Deterministic shuffled deck based on current timestamp (unique per game).
  const seed = Date.now() & 0xffffff;
  const deck = shuffledDeck(seed);

  if (raw.cardMode === "opposed") {
    // Opposed card games are not implemented yet — return a minimal valid stub
    // so the player can render a "Coming Soon" screen.
    const result: SolitaireScenario = {
      title: raw.title ?? "Opposed Card Game",
      theme: raw.theme ?? "Opposed card game",
      flavour: (raw.flavour ?? "Opposed card games are coming soon — try Solitaire for now.").slice(0, 100),
      variant: "klondike",
      rules: ["Opposed card games are coming soon", "Try Solitaire for now"],
      deck,
      cardMode: "opposed",
    };
    return SolitaireScenarioSchema.parse(result);
  }

  const result = {
    title: raw.title,
    theme: raw.theme,
    flavour: raw.flavour,
    variant: raw.variant ?? "klondike",
    rules: raw.rules ?? [],
    deck,
    cardMode: "solitaire" as const,
  };
  return SolitaireScenarioSchema.parse(result);
}
