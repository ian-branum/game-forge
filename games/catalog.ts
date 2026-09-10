import { triviaPlugin } from "./trivia/plugin";

const ALL_PLUGINS = [triviaPlugin];

export const CATALOG = ALL_PLUGINS.map(p => p.meta);

export function getCatalogEntry(gameType: string) {
  return CATALOG.find(m => m.id === gameType) ?? null;
}
