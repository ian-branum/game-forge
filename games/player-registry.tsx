import React from "react";
import type { PlayerPlugin } from "./shared/types";
import { sandboxPlayer } from "./sandbox/player";
import { narrativePlayer } from "./narrative/player";
import { tacticalPlayer } from "./tactical/player";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLAYER_REGISTRY: Record<string, PlayerPlugin<any>> = {
  sandbox: sandboxPlayer,
  narrative: narrativePlayer,
  tactical: tacticalPlayer,
};

export function getPlayerPlugin(gameType: string): PlayerPlugin | null {
  return PLAYER_REGISTRY[gameType] ?? null;
}
