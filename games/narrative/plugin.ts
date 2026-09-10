import type { ServerPlugin } from "@/games/shared/types";
import type { NarrativeScenario } from "./schema";
import { NarrativeScenarioSchema } from "./schema";
import { generateNarrativeScenario } from "./generator";
import { narrativeDemo } from "./demo";

export const narrativePlugin: ServerPlugin<NarrativeScenario> = {
  meta: {
    id: "narrative",
    name: "Adventure",
    description: "Branching text adventures",
    emoji: "📖",
    color: "#06b6d4",
    creditCost: 4,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "narrative", turnModel: "turn-based", runtimeIntelligence: "none" },
    ],
  },
  generate: generateNarrativeScenario,
  validate: (payload: unknown) => NarrativeScenarioSchema.parse(payload),
  demo: narrativeDemo,
};
