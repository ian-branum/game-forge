import type { ServerPlugin } from "@/games/shared/types";
import type { ScenarioDefinition } from "./engine/types";
import { ScenarioDefinitionSchema } from "./schema";
import { generateTacticalScenario } from "./generator";
import { normandyScenario } from "./engine/scenarios/normandy";

export const tacticalPlugin: ServerPlugin<ScenarioDefinition> = {
  meta: {
    id: "tactical",
    name: "Tactical",
    description: "Hex-based squad combat",
    emoji: "⚔️",
    color: "#4488ff",
    creditCost: 3,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "opposed", turnModel: "turn-based", runtimeIntelligence: "scripted" },
    ],
  },
  generate: generateTacticalScenario,
  validate: (payload: unknown) => ScenarioDefinitionSchema.parse(payload) as unknown as ScenarioDefinition,
  demo: normandyScenario,
};
