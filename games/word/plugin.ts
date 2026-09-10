import type { ServerPlugin } from "@/games/shared/types";
import type { WordPuzzle } from "./schema";
import { WordPuzzleSchema } from "./schema";
import { generateWordPuzzle } from "./generator";
import { wordDemo } from "./demo";

export const wordPlugin: ServerPlugin<WordPuzzle> = {
  meta: {
    id: "word",
    name: "Word Search",
    description: "Word search puzzles on any topic",
    emoji: "📝",
    color: "#22c55e",
    creditCost: 2,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "challenge", turnModel: "question-sequence", runtimeIntelligence: "none" },
    ],
  },
  generate: generateWordPuzzle,
  validate: (payload: unknown) => WordPuzzleSchema.parse(payload),
  demo: wordDemo,
};
