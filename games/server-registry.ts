import type { ServerPlugin } from "./shared/types";
import { triviaPlugin } from "./trivia/plugin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, ServerPlugin<any>> = {
  trivia: triviaPlugin,
};

export function getServerPlugin(gameType: string): ServerPlugin | null {
  return REGISTRY[gameType] ?? null;
}
