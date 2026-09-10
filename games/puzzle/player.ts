import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { LogicPuzzle } from "./schema";
import PuzzleGameComponent from "./PuzzleGame";

export const puzzlePlayer: PlayerPlugin<LogicPuzzle> = {
  id: "puzzle",
  Player: PuzzleGameComponent as unknown as React.ComponentType<{ scenario: LogicPuzzle }>,
};
