import type { ServerPlugin } from "@/games/shared/types";
import type { SandboxScenario } from "./schema";
import { SandboxScenarioSchema } from "./schema";
import { generateSandboxScenario } from "./generator";

const demoHtml = `<!DOCTYPE html><html><head><title>Demo Game</title></head><body style="background:#05071a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h1>Demo Game</h1></body></html>`;

export const sandboxPlugin: ServerPlugin<SandboxScenario> = {
  meta: {
    id: "sandbox",
    name: "Custom Board Game",
    description: "AI-generated game — any game, any variant",
    emoji: "🎮",
    color: "#4488ff",
    creditCost: 3,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "opposed", turnModel: "turn-based" },
      { interaction: "sandbox", turnModel: "real-time" },
    ],
  },
  generate: generateSandboxScenario,
  validate: (payload: unknown) => SandboxScenarioSchema.parse(payload),
  demo: { title: "Demo", description: "A demo game", html: demoHtml },
};
