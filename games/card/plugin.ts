import type { ServerPlugin } from "@/games/shared/types";
import type { SolitaireScenario } from "./schema";
import { SolitaireScenarioSchema } from "./schema";
import { generateCardScenario } from "./generator";
import { cardDemo } from "./demo";

export const cardPlugin: ServerPlugin<SolitaireScenario> = {
  meta: {
    id: "card",
    name: "Solitaire",
    description: "Thematic solitaire card games",
    emoji: "🃏",
    color: "#ef4444",
    creditCost: 2,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "challenge", turnModel: "turn-based", runtimeIntelligence: "none" },        // solitaire
      { interaction: "opposed",   turnModel: "turn-based", runtimeIntelligence: "generative" }, // future opposed
    ],
  },
  generate: generateCardScenario,
  validate: (payload: unknown) => SolitaireScenarioSchema.parse(payload),
  demo: cardDemo,
};
