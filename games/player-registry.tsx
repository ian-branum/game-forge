import React from "react";
import type { PlayerPlugin } from "./shared/types";
import { triviaPlayer } from "./trivia/player";
import { wordPlayer } from "./word/player";
import { puzzlePlayer } from "./puzzle/player";
import { cardPlayer } from "./card/player";
import { narrativePlayer } from "./narrative/player";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLAYER_REGISTRY: Record<string, PlayerPlugin<any>> = {
  trivia: triviaPlayer,
  word: wordPlayer,
  puzzle: puzzlePlayer,
  card: cardPlayer,
  narrative: narrativePlayer,
};

export function getPlayerPlugin(gameType: string): PlayerPlugin | null {
  return PLAYER_REGISTRY[gameType] ?? null;
}
