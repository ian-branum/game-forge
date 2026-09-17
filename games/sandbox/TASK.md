# TASK: Replace abstract-strategy with a sandbox code-gen game engine

## Summary
Replace the current `abstract-strategy` plugin (which only supports hardcoded chess and othello) with a new `sandbox` plugin that uses DeepSeek to generate a complete self-contained HTML/JS game, stores it as a payload, and renders it in a sandboxed iframe. This unlocks any board game, any variant, any custom piece type — all from a user prompt.

## Background
- game-forge.ai is a Next.js / TypeScript / Tailwind app at `/home/agentuser/game-forge`
- The existing plugin system: `games/server-registry.ts` (generation) + `games/player-registry.tsx` (rendering)
- Each plugin implements `ServerPlugin<T>` (generate + validate + demo) and `PlayerPlugin<T>` (Player component)
- The current `abstract-strategy` plugin calls DeepSeek but only outputs metadata (title, description) and routes to hardcoded engines. It cannot create new games or handle variants. It must be replaced.
- game-a-day (at `/home/agentuser/game-a-day`) has working examples of DeepSeek generating full playable games (chess, othello, snake, 2048, etc.) — reference those for style and prompting approach.

## What to build

### 1. Schema — `games/sandbox/schema.ts`
```typescript
import { z } from "zod";

export const SandboxScenarioSchema = z.object({
  title: z.string(),
  description: z.string(),
  html: z.string().min(100), // The full self-contained game HTML
});

export type SandboxScenario = z.infer<typeof SandboxScenarioSchema>;
```

### 2. Generator — `games/sandbox/generator.ts`
Call DeepSeek to generate a complete, self-contained HTML game document. Key requirements:
- Model: `deepseek-v4-flash`
- Max tokens: 16000 (games can be substantial)
- Temperature: 0.5
- Do NOT use `response_format: json_object` — the output is HTML, not JSON
- Strip markdown fences (` ```html ... ``` `) from output before storing
- Retry once on failure
- Return a `SandboxScenario` with title, description, and html

**System prompt** (use this verbatim or very close):
```
You are a world-class browser game developer. Generate a complete, self-contained HTML file for the requested game.

REQUIREMENTS:
- Single HTML file. All CSS and JavaScript inline. No external dependencies except Google Fonts.
- Google Fonts allowed: import Orbitron via @import in <style> tag.
- Dark theme: background #05071a, primary text #e2e8f0, accent glow #4488ff.
- Use Orbitron font for headings, titles, scores.
- Game canvas or DOM-based board. Responsive — works on mobile and desktop.
- Include an AI/computer opponent where applicable (minimax for simple games, heuristic for complex ones).
- Game must be fully playable: win/lose/draw detection, restart button, score display.
- Glowing visual effects via box-shadow and text-shadow where appropriate.
- Mobile touch controls where applicable (buttons ≥ 44px).
- Clean, modern aesthetic. No browser alerts — use in-page status messages.
- Output ONLY the raw HTML. No markdown. No explanation. No code fences.
```

**User message format**:
- For generation: `"Create a browser game: {prompt}"`
- For modification (chained): `"Here is the current game code:\n\n{existingHtml}\n\nModify it as follows: {modificationPrompt}\n\nOutput the complete modified HTML file."`

Parse the title and description from the generated HTML:
- Title: extract from `<title>` tag, fallback to prompt
- Description: first sentence of first `<meta name="description">` content, fallback to "A custom browser game"

### 3. Player — `games/sandbox/SandboxGame.tsx` + `games/sandbox/player.ts`

**SandboxGame.tsx** — renders the HTML in a sandboxed iframe:
```tsx
"use client";
import type { SandboxScenario } from "./schema";

export default function SandboxGame({ scenario }: { scenario: SandboxScenario }) {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#05071a" }}>
      <iframe
        srcDoc={scenario.html}
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "#05071a",
        }}
        title={scenario.title}
      />
    </div>
  );
}
```

**player.ts**:
```typescript
import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { SandboxScenario } from "./schema";
import SandboxGame from "./SandboxGame";

export const sandboxPlayer: PlayerPlugin<SandboxScenario> = {
  id: "sandbox",
  Player: SandboxGame as unknown as React.ComponentType<{ scenario: SandboxScenario }>,
};
```

### 4. Plugin — `games/sandbox/plugin.ts`
```typescript
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
```

### 5. Wire up the modification route for sandbox
The existing `/api/scenarios/[id]/modify/route.ts` calls `serverPlugin.generate(chainedPrompt)` — but for sandbox, the modification needs to pass the EXISTING HTML along with the modification prompt, not just the chained text prompts.

Update the modify route to detect `scenario.category === "sandbox"` and call a separate `modifySandboxScenario(existingHtml, modificationPrompt)` function instead of the generic `generate()`.

Add `modifySandboxScenario` to `games/sandbox/generator.ts`:
```typescript
export async function modifySandboxScenario(existingHtml: string, modificationPrompt: string): Promise<SandboxScenario>
```
Uses the modification user message format from §2 above.

Update `/api/scenarios/[id]/modify/route.ts`:
```typescript
// After fetching the scenario:
let payload: unknown;
if (scenario.category === "sandbox") {
  const { modifySandboxScenario } = await import("@/games/sandbox/generator");
  const existingHtml = (scenario.payload as { html?: string })?.html ?? "";
  payload = await modifySandboxScenario(existingHtml, modificationPrompt);
} else {
  payload = await serverPlugin.generate(chainedPrompt);
}
```

### 6. Register the plugin
- `games/server-registry.ts`: add `import { sandboxPlugin } from "./sandbox/plugin"` and add `sandbox: sandboxPlugin` to REGISTRY
- `games/player-registry.tsx`: add `import { sandboxPlayer } from "./sandbox/player"` and add `sandbox: sandboxPlayer` to PLAYER_REGISTRY

### 7. Update the forge UI to offer "sandbox" as a game type
In the forge page (likely `app/forge/page.tsx` or similar), add the sandbox option to the game type selector. It should appear as "Custom Board Game 🎮" or similar. The classifier (`/api/classify`) should also be updated to route board-game-like prompts to "sandbox" when abstract-strategy is selected — or simply always route to "sandbox" for any board/strategy game request.

Check `app/forge/` and update the UI to include sandbox as a selectable game type.

### 8. Keep abstract-strategy registered but mark unavailable
In `games/abstract-strategy/plugin.ts`, set `available: false` in the meta — this preserves existing saved scenarios but hides it from the UI for new game creation.

## Acceptance Criteria
- [ ] User can type "chess" → a fully playable chess game is generated and rendered in the iframe
- [ ] User can type "10x10 chess with artillery pieces" → a valid game is generated (may not be perfect but must load and be playable)
- [ ] User can modify an existing sandbox game with a follow-up prompt → the HTML is updated and the new version is stored
- [ ] The iframe renders with no visible border, fills the play page, dark background
- [ ] abstract-strategy plugin still loads for existing saved games but is not offered for new creation
- [ ] No TypeScript errors, project builds (`npm run build`)

## Files to create/modify
**Create:**
- `games/sandbox/schema.ts`
- `games/sandbox/generator.ts`
- `games/sandbox/SandboxGame.tsx`
- `games/sandbox/player.ts`
- `games/sandbox/plugin.ts`

**Modify:**
- `games/server-registry.ts` — register sandbox
- `games/player-registry.tsx` — register sandbox player
- `games/abstract-strategy/plugin.ts` — set available: false
- `app/api/scenarios/[id]/modify/route.ts` — sandbox-aware modification
- `app/forge/` — add sandbox to game type UI (check what files exist)

## Reference
- Existing game-a-day games in `/home/agentuser/game-a-day/app/games/` — reference for what good generated game HTML looks like
- game-a-day generate API: `/home/agentuser/game-a-day/app/api/game-ai/route.ts`
- game-forge plugin pattern: any existing plugin (e.g. `games/trivia/`) for the full generator→schema→plugin→player pattern
