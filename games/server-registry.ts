import type { ServerPlugin } from "./shared/types";
import { sandboxPlugin } from "./sandbox/plugin";
import { narrativePlugin } from "./narrative/plugin";
import { tacticalPlugin } from "./tactical/plugin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, ServerPlugin<any>> = {
  sandbox: sandboxPlugin,
  narrative: narrativePlugin,
  tactical: tacticalPlugin,
};

export function getServerPlugin(gameType: string): ServerPlugin | null {
  return REGISTRY[gameType] ?? null;
}
