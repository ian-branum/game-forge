import type { ServerPlugin } from "@/games/shared/types";
import type { AbstractStrategyScenario } from "./schema";
import { AbstractStrategyScenarioSchema } from "./schema";
import { generateAbstractStrategyScenario } from "./generator";
import { othelloDemo } from "./demo";

export const abstractStrategyPlugin: ServerPlugin<AbstractStrategyScenario> = {
  meta: {
    id: "abstract-strategy",
    name: "Abstract Strategy",
    description: "Classic strategy games vs AI",
    emoji: "♟️",
    color: "#a855f7",
    creditCost: 2,
    schemaVersion: "1.0",
    available: false,
    supportedProfiles: [
      { interaction: "opposed", turnModel: "turn-based", runtimeIntelligence: "search-based" },   // algorithmic
      { interaction: "opposed", turnModel: "turn-based", runtimeIntelligence: "generative" },     // llm-opponent
    ],
  },
  generate: generateAbstractStrategyScenario,
  validate: (payload: unknown) => AbstractStrategyScenarioSchema.parse(payload),
  demo: othelloDemo,
};
