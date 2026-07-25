import type { SolitaireScenario, PlayingCard, Suit, CardValue } from "@/lib/generators/card";

// Pre-shuffled deck for a reproducible demo game of Klondike
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES: CardValue[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function seededDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS)
    for (const value of VALUES)
      deck.push({ suit, value });
  // Seeded Fisher-Yates with seed 42
  let s = 42;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const cardDemo: SolitaireScenario = {
  title: "The Pirate's Solitaire",
  theme: "Pirates of the Caribbean Sea",
  flavour: "Sort the treasure — Aces to Kings — before the tide comes in.",
  variant: "klondike",
  rules: [
    "Build foundation piles Ace→King by suit",
    "Stack tableau cards in descending rank, alternating color",
    "Click stock to draw; click waste card to play it",
    "Empty columns accept only Kings",
  ],
  deck: seededDeck(),
};
