# TASK: Abstract Strategy Plugin + Card Dual-Mode Foundation

## Overview

Replace the `puzzle` game category with `abstract-strategy`. Add `abstract-strategy` as a new plugin that supports two opponent modes: algorithmic (minimax) and LLM-opponent. Ship Othello (algorithmic) and Chess (LLM) as the first two games. Update the card plugin to support the same dual-mode structure as a foundation for future opposed card games (Spades etc.) — no new card game UI needed yet, just the schema and generator branching.

---

## Part 1: Create `games/abstract-strategy/` plugin

### 1a. Schema — `games/abstract-strategy/schema.ts`

```ts
import { z } from "zod";

export const OpponentModeSchema = z.enum(["algorithmic", "llm-opponent"]);

export const AbstractStrategyScenarioSchema = z.object({
  gameId: z.enum(["othello", "chess"]),          // extend as more games added
  title: z.string(),
  description: z.string(),
  opponentMode: OpponentModeSchema,               // "algorithmic" | "llm-opponent"
  // For llm-opponent games, the generator may include opening state or variant rules
  variant: z.string().optional(),                 // e.g. "standard", "chess960"
  aiPersonality: z.string().optional(),           // flavour for LLM prompt e.g. "aggressive", "defensive"
});

export type OpponentMode = z.infer<typeof OpponentModeSchema>;
export type AbstractStrategyScenario = z.infer<typeof AbstractStrategyScenarioSchema>;
```

### 1b. Generator — `games/abstract-strategy/generator.ts`

The generator:
1. Uses DeepSeek to classify whether the requested game is `algorithmic` or `llm-opponent`
2. Returns a `AbstractStrategyScenario` payload

Classification criteria to embed in the system prompt:
- **algorithmic**: small state space, minimax searchable to depth 4+ in < 200ms, well-known evaluation function (Othello, Connect 4, Checkers, Tic-tac-toe)
- **llm-opponent**: complex evaluation requiring strategic intuition or branching factor too large (Chess, Go, Shogi, novel/unknown games)

The generator should also extract the `gameId` by matching the prompt against known games. If the prompt doesn't match a known supported game, return an error (we only support known games for now — no dynamically generated abstract strategy game engines).

Known games: `othello`, `chess`

```ts
// Pseudocode structure:
export async function generateAbstractStrategyScenario(prompt: string): Promise<AbstractStrategyScenario> {
  // 1. Call DeepSeek to extract { gameId, opponentMode, variant?, aiPersonality? }
  // 2. Validate gameId is in supported list
  // 3. Return AbstractStrategyScenario
}
```

System prompt for the generator should instruct DeepSeek to output JSON:
```json
{
  "gameId": "othello" | "chess",
  "opponentMode": "algorithmic" | "llm-opponent",
  "title": string,
  "description": string,
  "variant": string | null,
  "aiPersonality": string | null
}
```

### 1c. Player — `games/abstract-strategy/player.ts`

```ts
import React from "react";
import type { PlayerPlugin } from "@/games/shared/types";
import type { AbstractStrategyScenario } from "./schema";
import AbstractStrategyGameComponent from "./AbstractStrategyGame";

export const abstractStrategyPlayer: PlayerPlugin<AbstractStrategyScenario> = {
  id: "abstract-strategy",
  Player: AbstractStrategyGameComponent as unknown as React.ComponentType<{ scenario: AbstractStrategyScenario }>,
};
```

### 1d. Plugin — `games/abstract-strategy/plugin.ts`

```ts
export const abstractStrategyPlugin: ServerPlugin<AbstractStrategyScenario> = {
  meta: {
    id: "abstract-strategy",
    name: "Abstract Strategy",
    description: "Classic strategy games vs AI",
    emoji: "♟️",
    color: "#a855f7",
    creditCost: 2,
    schemaVersion: "1.0",
    available: true,
    supportedProfiles: [
      { interaction: "opposed", turnModel: "turn-based", runtimeIntelligence: "search-based" },   // algorithmic
      { interaction: "opposed", turnModel: "turn-based", runtimeIntelligence: "generative" },     // llm-opponent
    ],
  },
  generate: generateAbstractStrategyScenario,
  validate: (payload: unknown) => AbstractStrategyScenarioSchema.parse(payload),
  demo: othelloDemo,
};
```

### 1e. Demo — `games/abstract-strategy/demo.ts`

```ts
export const othelloDemo: AbstractStrategyScenario = {
  gameId: "othello",
  title: "Othello",
  description: "Classic 8×8 reversi. Flip your opponent's pieces. Control the board.",
  opponentMode: "algorithmic",
};
```

### 1f. Game Component — `games/abstract-strategy/AbstractStrategyGame.tsx`

This is a router component. It receives `scenario: AbstractStrategyScenario` and renders the right game:

```tsx
"use client";
import type { AbstractStrategyScenario } from "./schema";
import OthelloGame from "./games/OthelloGame";
import ChessGame from "./games/ChessGame";

export default function AbstractStrategyGame({ scenario }: { scenario: AbstractStrategyScenario }) {
  if (scenario.gameId === "othello") return <OthelloGame scenario={scenario} />;
  if (scenario.gameId === "chess")   return <ChessGame scenario={scenario} />;
  return <div>Unknown game: {scenario.gameId}</div>;
}
```

---

## Part 2: OthelloGame — migrate existing component

Move the logic from `components/OthelloGame.tsx` into `games/abstract-strategy/games/OthelloGame.tsx`.

**Key changes:**
- Accept `scenario: AbstractStrategyScenario` as a prop (ignore it for now — Othello is always the same)
- Otherwise identical to the existing `components/OthelloGame.tsx`
- Keep all existing logic: minimax depth-3, alpha-beta pruning, position weighting, pass handling

The existing `components/OthelloGame.tsx` should remain in place for now (it's referenced by `/play/othello-demo` hardcoded route) — we'll clean up that hardcoded route separately.

---

## Part 3: ChessGame — LLM-opposed Chess

Create `games/abstract-strategy/games/ChessGame.tsx`.

### Architecture

Chess is an LLM-opponent game. The AI opponent is DeepSeek, called via `/api/abstract-strategy/move` (create this API route).

**Game state**: standard chess, starting position. Player is White, AI is Black.

### What to build

**ChessGame.tsx** — React component with:
- Full 8×8 chess board, dark theme, Orbitron font, same visual style as Othello
- Board renders pieces using Unicode chess symbols:
  - White: ♔♕♖♗♘♙  Black: ♚♛♜♝♞♟
- Starting position: standard chess setup
- Click to select piece → highlights valid squares → click to move
- Valid move generation (pure TypeScript, no library):
  - All piece types: pawn (incl. en passant, promotion to queen auto), knight, bishop, rook, queen, king
  - Castling (kingside and queenside, if not moved and path clear and not in check)
  - Check detection: cannot move into check
  - Checkmate and stalemate detection
- After each human move, show "AI thinking..." and call `/api/abstract-strategy/move`
- Display captured pieces, current turn indicator, check/checkmate/stalemate status

**State representation:**
```ts
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type Color = "white" | "black";
type Square = { type: PieceType; color: Color } | null;
type Board = Square[][]; // [8][8], [0][0] = a8 (top-left = black's back rank)
```

**API route** — `app/api/abstract-strategy/move/route.ts`:

```ts
// POST body: { fen: string, history: string[], aiPersonality?: string }
// Response: { move: string } where move is in "e2e4" or algebraic notation
```

The API calls DeepSeek with:
- The current board state as FEN string
- Move history
- System prompt instructing it to play as Black and respond with a single legal move in format "from-to" e.g. "e7e5", "g8f6"
- The component then parses and applies that move

**FEN generation**: implement a `boardToFen(board, ...)` function in the component or a lib file.

**Move parsing**: the API returns a move like `"e2e4"` — parse source/dest squares and apply.

**Error handling**: if AI returns an illegal or unparseable move, retry once, then display "AI resigned" (forfeit).

### Visual style
- Same dark bg `#05071a`, Orbitron font
- White squares: `#1a2a4a`, Black squares: `#0a1020`  
- Selected square: bright blue highlight
- Valid move dots: green dots (same as Othello)
- Last move: golden highlight on from/to squares
- Check indicator: red glow on king square
- Piece font size: ~36px, centered in square
- Board: 8×8, responsive, fits mobile (each square ~44px min)
- Captured pieces shown in a strip above/below board

---

## Part 4: Card plugin dual-mode foundation

Update the card plugin schema and generator to support a `cardMode` field:

### 4a. Update `games/card/schema.ts`

Add to `SolitaireScenarioSchema`:
```ts
cardMode: z.enum(["solitaire", "opposed"]).default("solitaire"),
```

Keep all existing solitaire fields as-is. The `opposed` mode is reserved for future games (Spades etc.) — no player UI changes needed.

### 4b. Update `games/card/generator.ts`

Update the system prompt and generation logic:
- Generator should detect if the prompt is requesting a solitaire game vs an opposed card game
- For solitaire: generate as today (klondike/freecell/pyramid + deck)
- For opposed: set `cardMode: "opposed"`, and include a `title` and `description` but do NOT generate the full game rules yet (just stub it) — return a minimal valid payload with `cardMode: "opposed"` and a note that this game type is coming soon
- The player component should check `cardMode` and show a "Coming Soon" screen for `"opposed"` games

### 4c. Update `games/card/CardGame.tsx`

At the top, check `scenario.cardMode`:
```tsx
if (scenario.cardMode === "opposed") {
  return <div className="...">Opposed card games coming soon — try Solitaire for now!</div>;
}
// existing solitaire rendering below
```

### 4d. Update `games/card/plugin.ts`

Add `opposed` profile:
```ts
supportedProfiles: [
  { interaction: "challenge", turnModel: "turn-based", runtimeIntelligence: "none" },        // solitaire
  { interaction: "opposed",   turnModel: "turn-based", runtimeIntelligence: "generative" }, // future opposed
],
```

---

## Part 5: Wire everything up

### 5a. Remove puzzle, add abstract-strategy to registries

**`games/catalog.ts`** — replace `puzzlePlugin` with `abstractStrategyPlugin`

**`games/server-registry.ts`** — replace `puzzle: puzzlePlugin` with `abstract-strategy: abstractStrategyPlugin`

**`games/player-registry.tsx`** — replace `puzzle: puzzlePlayer` with `abstract-strategy: abstractStrategyPlayer`

### 5b. Update classifier — `games/classifier/classify-game.ts`

Update the available game types in the system prompt:
- Remove `logic-puzzle`
- Add `abstract-strategy`: "Classic strategy games vs an AI opponent. Turn-based. Includes Othello, Chess, Checkers, Connect 4, etc."

### 5c. Update Forge page — `app/forge/page.tsx`

Replace the `puzzle` category entry with:
```ts
{ id: "abstract-strategy", label: "Strategy", emoji: "♟️", desc: "Classic strategy vs AI", available: true },
```

The demo section at the bottom: replace `normandy-demo` link with two links — Normandy demo + Othello demo (keep othello-demo hardcoded route for now, Normandy stays as-is too).

Actually: keep the demo section as two links:
```tsx
<a href="/play/normandy-demo">⚔️ Normandy Demo</a>
<a href="/play/othello-demo">♟️ Othello Demo</a>
```

### 5d. Update `/play/[id]/page.tsx`

Add handling for abstract-strategy DB rows — they should route through the plugin system (which they will automatically, once the player is registered). No hardcoded route changes needed beyond what the plugin registry covers.

The existing `othello-demo` hardcoded route stays in place.

---

## Part 6: DB seed for demo scenarios (SKIP for now)

We will handle inserting Normandy and Othello as real DB rows in a separate task. For now, both remain as hardcoded demo routes. Do not add any seed scripts or DB inserts in this task.

---

## Style Conventions (apply to all new components)

- `"use client"` at top of all React components
- Dark bg `#05071a`, Orbitron font via `font-orbitron` class
- Game loop state: hot-path logic in refs or plain state, no unnecessary re-renders
- Glowing effects via `boxShadow`
- Mobile: touch targets ≥ 44px
- Catch-all error fallback if AI unavailable
- No external game libraries (chess.js, etc.) — implement move logic in pure TypeScript

---

## Files to Create

```
games/abstract-strategy/schema.ts
games/abstract-strategy/generator.ts
games/abstract-strategy/player.ts
games/abstract-strategy/plugin.ts
games/abstract-strategy/demo.ts
games/abstract-strategy/AbstractStrategyGame.tsx
games/abstract-strategy/games/OthelloGame.tsx       ← migrated from components/OthelloGame.tsx
games/abstract-strategy/games/ChessGame.tsx          ← new
app/api/abstract-strategy/move/route.ts              ← new API route for Chess AI
```

## Files to Modify

```
games/catalog.ts                   ← swap puzzle → abstract-strategy
games/server-registry.ts           ← swap puzzle → abstract-strategy
games/player-registry.tsx          ← swap puzzle → abstract-strategy
games/classifier/classify-game.ts  ← update game type list
games/card/schema.ts               ← add cardMode field
games/card/generator.ts            ← detect solitaire vs opposed
games/card/CardGame.tsx            ← handle opposed mode (coming soon screen)
games/card/plugin.ts               ← add opposed profile
app/forge/page.tsx                 ← swap puzzle → abstract-strategy in CATEGORIES
```

## Files to Leave Alone

```
components/OthelloGame.tsx         ← keep (still used by hardcoded othello-demo route)
games/puzzle/                      ← keep entire directory (don't delete, just unregister)
app/play/[id]/page.tsx             ← keep hardcoded demo routes as-is
```

---

## Acceptance Criteria

1. `/forge` page shows "Strategy ♟️" instead of "Puzzle 🧩"
2. Forging "play Othello" → generates scenario → navigates to `/play/[id]` → Othello board renders
3. Forging "play Chess" → generates scenario → Chess board renders, human plays White, AI (DeepSeek) plays Black
4. Forging "play a card game about pirates" → solitaire as before
5. Forging "play Spades" → opposed card game detected → "Coming Soon" screen
6. `/play/othello-demo` still works (hardcoded route untouched)
7. `/play/normandy-demo` still works (hardcoded route untouched)
8. TypeScript compiles clean (`npx tsc --noEmit`)
9. No external chess or game libraries added to package.json
