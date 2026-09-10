import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { WordPuzzle } from "./schema";
import WordGameComponent from "./WordGame";

export const wordPlayer: PlayerPlugin<WordPuzzle> = {
  id: "word",
  Player: WordGameComponent as unknown as React.ComponentType<{ scenario: WordPuzzle }>,
};
