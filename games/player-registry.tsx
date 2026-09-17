import React from "react";
import type { PlayerPlugin } from "./shared/types";
import { triviaPlayer } from "./trivia/player";
import { wordPlayer } from "./word/player";
import { abstractStrategyPlayer } from "./abstract-strategy/player";
import { sandboxPlayer } from "./sandbox/player";
import { cardPlayer } from "./card/player";
import { narrativePlayer } from "./narrative/player";
import { tacticalPlayer } from "./tactical/player";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLAYER_REGISTRY: Record<string, PlayerPlugin<any>> = {
  trivia: triviaPlayer,
  word: wordPlayer,
  "abstract-strategy": abstractStrategyPlayer,
  sandbox: sandboxPlayer,
  card: cardPlayer,
  narrative: narrativePlayer,
  tactical: tacticalPlayer,
};

export function getPlayerPlugin(gameType: string): PlayerPlugin | null {
  return PLAYER_REGISTRY[gameType] ?? null;
}
