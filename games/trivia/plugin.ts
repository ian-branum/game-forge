import type { ServerPlugin } from "@/games/shared/types";
import type { TriviaScenario } from "./schema";
import { TriviaScenarioSchema } from "./schema";
import { generateTriviaScenario } from "./generator";
import { triviaDemo } from "./demo";

export const triviaPlugin: ServerPlugin<TriviaScenario> = {
  meta: {
    id: "trivia",
    name: "Trivia",
    description: "Quiz on any topic",
    emoji: "🧠",
    color: "#a855f7",
    creditCost: 1,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "challenge", turnModel: "question-sequence", runtimeIntelligence: "none" },
    ],
  },
  generate: generateTriviaScenario,
  validate: (payload: unknown) => TriviaScenarioSchema.parse(payload),
  demo: triviaDemo,
};
