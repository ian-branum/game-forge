import React from "react";
import type { PlayerPlugin } from "./shared/types";
import { triviaPlayer } from "./trivia/player";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLAYER_REGISTRY: Record<string, PlayerPlugin<any>> = {
  trivia: triviaPlayer,
};

export function getPlayerPlugin(gameType: string): PlayerPlugin | null {
  return PLAYER_REGISTRY[gameType] ?? null;
}
