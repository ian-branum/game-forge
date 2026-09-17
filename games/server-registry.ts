import type { ServerPlugin } from "./shared/types";
import { triviaPlugin } from "./trivia/plugin";
import { wordPlugin } from "./word/plugin";
import { abstractStrategyPlugin } from "./abstract-strategy/plugin";
import { sandboxPlugin } from "./sandbox/plugin";
import { cardPlugin } from "./card/plugin";
import { narrativePlugin } from "./narrative/plugin";
import { tacticalPlugin } from "./tactical/plugin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, ServerPlugin<any>> = {
  trivia: triviaPlugin,
  word: wordPlugin,
  "abstract-strategy": abstractStrategyPlugin,
  sandbox: sandboxPlugin,
  card: cardPlugin,
  narrative: narrativePlugin,
  tactical: tacticalPlugin,
};

export function getServerPlugin(gameType: string): ServerPlugin | null {
  return REGISTRY[gameType] ?? null;
}
