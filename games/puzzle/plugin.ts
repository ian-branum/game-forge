import type { ServerPlugin } from "@/games/shared/types";
import type { LogicPuzzle } from "./schema";
import { LogicPuzzleSchema } from "./schema";
import { generateLogicPuzzle } from "./generator";
import { puzzleDemo } from "./demo";

export const puzzlePlugin: ServerPlugin<LogicPuzzle> = {
  meta: {
    id: "puzzle",
    name: "Logic Puzzle",
    description: "Deductive logic grid puzzles",
    emoji: "🧩",
    color: "#f59e0b",
    creditCost: 1,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "challenge", turnModel: "turn-based", runtimeIntelligence: "none" },
    ],
  },
  generate: generateLogicPuzzle,
  validate: (payload: unknown) => LogicPuzzleSchema.parse(payload),
  demo: puzzleDemo,
};
