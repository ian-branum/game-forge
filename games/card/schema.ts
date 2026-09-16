import { z } from "zod";

export const SuitSchema = z.enum(["♠", "♥", "♦", "♣"]);
export const CardValueSchema = z.enum(["A","2","3","4","5","6","7","8","9","10","J","Q","K"]);

export const PlayingCardSchema = z.object({
  suit: SuitSchema,
  value: CardValueSchema,
});

export const SolitaireScenarioSchema = z.object({
  title: z.string(),
  theme: z.string(),
  flavour: z.string(),
  variant: z.enum(["klondike", "freecell", "pyramid"]),
  rules: z.array(z.string()),
  deck: z.array(PlayingCardSchema),
  // "opposed" is reserved for future two-player card games (Spades, etc.).
  cardMode: z.enum(["solitaire", "opposed"]).default("solitaire"),
});

export type Suit = z.infer<typeof SuitSchema>;
export type CardValue = z.infer<typeof CardValueSchema>;
export type PlayingCard = z.infer<typeof PlayingCardSchema>;
export type SolitaireScenario = z.infer<typeof SolitaireScenarioSchema>;
