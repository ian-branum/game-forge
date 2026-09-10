import { triviaPlugin } from "./trivia/plugin";
import { wordPlugin } from "./word/plugin";
import { puzzlePlugin } from "./puzzle/plugin";
import { cardPlugin } from "./card/plugin";
import { narrativePlugin } from "./narrative/plugin";

const ALL_PLUGINS = [triviaPlugin, wordPlugin, puzzlePlugin, cardPlugin, narrativePlugin];

export const CATALOG = ALL_PLUGINS.map(p => p.meta);

export function getCatalogEntry(gameType: string) {
  return CATALOG.find(m => m.id === gameType) ?? null;
}
