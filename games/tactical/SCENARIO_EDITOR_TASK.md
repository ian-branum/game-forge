# TASK: Tactical Scenario Editor

## Summary
Build a scenario editor that sits between AI generation and gameplay for tactical (WW2 hex) games. After AI generates a `ScenarioDefinition`, instead of going straight to `/play/[id]`, tactical games route through a **ScenarioEditor** where the user can inspect and optionally modify the map, units, and objectives before locking in and playing.

---

## Scope
- **New component:** `games/tactical/ScenarioEditor.tsx`
- **New hook:** `games/tactical/engine/useEditorHistory.ts` (undo/redo)
- **Modify:** `app/forge/page.tsx` — after SSE `done` event for tactical category, route to editor instead of `/play/[id]` directly
- **New route:** `app/editor/[id]/page.tsx` — server page that loads scenario and renders ScenarioEditor
- **No changes** to `TacticalGame.tsx`, engine, or schema

---

## Acceptance Criteria
1. After forging a tactical game, user lands on the editor page (not the game directly)
2. Editor shows the hex map in **Preview mode** by default — palettes visible but disabled
3. "Edit Map" button switches to **Edit mode** — palettes become active
4. User can paint terrain, place/erase units and objectives, then hit **Done**
5. Done saves the modified scenario to the DB and navigates to `/play/[id]`
6. Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z) work in edit mode, plus visible Undo/Redo buttons
7. Unit placed on map appears in inventory panel; unit removed disappears from inventory
8. Clicking a unit on map or in inventory highlights both
9. Mobile: tap-to-select then tap-destination for unit placement; drag painting disabled on touch (tap-per-hex only)

---

## Layout (three-column, full viewport height minus nav)

```
┌─────────────────┬──────────────────────────────┬─────────────────┐
│  LEFT PALETTE   │         HEX MAP               │  RIGHT INVENTORY│
│                 │                               │                 │
│ ── TERRAIN ──   │   [hex grid, centered]        │ ── ALLIED ──    │
│ 🟫 Open         │                               │  • Sgt. Miller  │
│ 🟩 Woods        │   [Preview mode: dim overlay] │  • Rifle Squad  │
│ 🏚 Building     │   [Edit mode: interactive]    │                 │
│ 🟨 Wheatfield   │                               │ ── AXIS ──      │
│ 🛣 Road         │                               │  • Schütze     │
│ 🪨 Rubble       │                               │  • MG-42 Team   │
│ 🧱 Wall         │                               │                 │
│ [Eraser]        │                               │ ── OBJECTIVES ──│
│                 │                               │  • Hill 203     │
│ ── ALLIED ──    │                               │  • Farmhouse    │
│ 🪖 Rifle Squad  │                               │                 │
│ ⭐ Leader       │                               │                 │
│ 🔫 MG Team      │                               │                 │
│ 💣 Mortar       │                               │                 │
│                 │                               │                 │
│ ── AXIS ──      │                               │                 │
│ 🪖 Schütze      │                               │                 │
│ ⭐ Leader       │                               │                 │
│ 🔫 MG-42        │                               │                 │
│ 💣 Granatwerfer │                               │                 │
│ [Eraser]        │                               │                 │
│                 │                               │                 │
│ ── OBJECTIVES ──│                               │                 │
│ 🎯 Objective    │                               │                 │
│ [Eraser]        │                               │                 │
└─────────────────┴──────────────────────────────┴─────────────────┘

[UNDO] [REDO]      [PREVIEW / EDIT toggle]       [DONE →]
```

---

## State Model

```ts
// Editor operates on a mutable copy of ScenarioDefinition
// The original AI-generated version is never mutated
type EditorState = {
  scenario: ScenarioDefinition;   // current working copy
  mode: "preview" | "edit";
  selectedTool: SelectedTool | null;
  selectedUnitId: string | null;  // for highlight sync map ↔ inventory
  history: ScenarioDefinition[];  // undo stack (push before each change)
  future: ScenarioDefinition[];   // redo stack
};

type SelectedTool =
  | { kind: "terrain"; terrain: TerrainType }
  | { kind: "terrain-eraser" }
  | { kind: "unit"; faction: Faction; unitType: UnitType }
  | { kind: "unit-eraser" }
  | { kind: "objective" }
  | { kind: "objective-eraser" };
```

---

## Interaction Rules

### Terrain tool (selected from palette)
- **Desktop:** mousedown on hex sets terrain; mousemove while button held paints drag (set terrain on each entered hex)
- **Mobile:** tap per hex (no drag painting — detect `ontouchstart` and disable drag)
- Terrain eraser: same gesture, reverts hex to `"open"`

### Unit tool (selected from palette)
- Click/tap a hex → place one unit of that type+faction at that hex
- Multiple units can share a hex (stacking)
- Unit eraser: click/drag removes ALL units from a hex (drag works on mobile too for erasing)
- **Unit repositioning:** click a unit in the inventory panel → it becomes "selected" (highlighted on map) → click/tap any hex to move it there
  - If multiple units on a hex: clicking the hex opens a small popover listing units; user picks one, then clicks destination
  - Alternatively, always use inventory panel to select (unambiguous)

### Objective tool
- Click/tap hex → place objective marker (prompts for label — simple `window.prompt` or inline input on the hex)
- Objective eraser: click/drag removes objectives

### Undo / Redo
- Before any mutation, push current `scenario` to `history`, clear `future`
- Undo: pop from `history`, push current to `future`, restore popped state
- Redo: pop from `future`, push current to `history`, restore popped state
- Keyboard: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- Buttons in toolbar: Undo / Redo — disabled when stack is empty

### Done button
- POST to `/api/scenarios/[id]` with the modified `ScenarioDefinition` payload
- On success → `router.push('/play/[id]')`

---

## Unit Templates (for palette — clone these when placing)

Derive base stats from the existing unit definitions in the AI-generated scenario where possible. For new units placed by the user (not in the original scenario), use these defaults:

```ts
const UNIT_TEMPLATES = {
  allied: {
    infantry: { name: "Rifle Squad", attack: 4, defense: 3, movement: 4, range: 3, morale: 7, emoji: "🪖" },
    leader:   { name: "Sergeant",    attack: 2, defense: 2, movement: 5, range: 2, morale: 9, emoji: "⭐" },
    mg:       { name: "BAR Team",    attack: 6, defense: 2, movement: 3, range: 5, morale: 7, emoji: "🔫" },
    mortar:   { name: "Mortar Team", attack: 5, defense: 2, movement: 2, range: 6, morale: 6, emoji: "💣" },
    vehicle:  { name: "Sherman",     attack: 8, defense: 6, movement: 5, range: 5, morale: 9, emoji: "🛡" },
  },
  axis: {
    infantry: { name: "Schütze",        attack: 4, defense: 3, movement: 4, range: 3, morale: 7, emoji: "🪖" },
    leader:   { name: "Unteroffizier",  attack: 2, defense: 2, movement: 5, range: 2, morale: 9, emoji: "⭐" },
    mg:       { name: "MG-42 Team",     attack: 7, defense: 2, movement: 2, range: 6, morale: 7, emoji: "🔫" },
    mortar:   { name: "Granatwerfer",   attack: 5, defense: 2, movement: 2, range: 6, morale: 6, emoji: "💣" },
    vehicle:  { name: "Panzer IV",      attack: 8, defense: 7, movement: 5, range: 5, morale: 9, emoji: "🛡" },
  },
};
```

Generate unique IDs for placed units: `${faction}-${type}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`

---

## Routing Change (app/forge/page.tsx)

In the SSE `done` handler, change:
```ts
// BEFORE
router.push(`/play/${payload.id}`);

// AFTER — tactical goes to editor first
if (category === "tactical") {
  router.push(`/editor/${payload.id}`);
} else {
  router.push(`/play/${payload.id}`);
}
```

---

## New Route: app/editor/[id]/page.tsx

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ScenarioEditor from "@/games/tactical/ScenarioEditor";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row || row.category !== "tactical") return notFound();
  return <ScenarioEditor scenarioId={id} initialScenario={row.payload as ScenarioDefinition} />;
}
```

---

## API: PATCH /api/scenarios/[id]

New route: `app/api/scenarios/[id]/route.ts`

```ts
// PATCH — update scenario payload (editor save)
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await prisma.scenario.findUnique({ where: { id } });
  if (!row || row.userId !== session.user.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  // Validate with ScenarioDefinitionSchema (strip the injected `id` field first)
  const parsed = ScenarioDefinitionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid scenario", detail: parsed.error }, { status: 400 });
  await prisma.scenario.update({ where: { id }, data: { payload: parsed.data } });
  return Response.json({ ok: true });
}
```

---

## Visual Style (match existing game-forge aesthetic)
- `"use client"` at top
- Dark bg `#05071a`, Orbitron font via `font-orbitron` class
- Palette panel: `bg-gray-900/60 border-r border-gray-800`
- Inventory panel: `bg-gray-900/60 border-l border-gray-800`
- Selected tool: highlighted with indigo ring (`ring-2 ring-indigo-500`)
- Preview mode overlay: semi-transparent dark veil over palettes with "click Edit to modify" tooltip
- Undo/Redo buttons: small, icon-style (↩ ↪), disabled state grayed out
- Done button: same style as FORGE GAME button — indigo gradient, Orbitron, full width at bottom right
- Highlighted unit (selected): glowing ring on hex + row highlight in inventory (`bg-indigo-900/40`)

---

## Hex Rendering
Reuse the hex geometry helpers from `TacticalGame.tsx`:
- `hexCenter(row, col)` → `[x, y]`
- `hexPoints(cx, cy, r)` → SVG polygon points string
- `TERRAIN_FILL` color map
- Render on `<svg>` with `onMouseDown`, `onMouseMove`, `onMouseUp` for desktop painting
- Add `onTouchStart` per hex for mobile tap

---

## Out of Scope
- Editing scenario metadata (title, briefing, turn count, win conditions) — not in this version
- Saving editor state mid-session (auto-save) — Done is the only save
- Multi-user collaboration
- Undo history persistence across page refreshes

---

## File Summary
| File | Action |
|------|--------|
| `games/tactical/ScenarioEditor.tsx` | **CREATE** — main editor component |
| `games/tactical/engine/useEditorHistory.ts` | **CREATE** — undo/redo hook |
| `app/editor/[id]/page.tsx` | **CREATE** — server route |
| `app/api/scenarios/[id]/route.ts` | **CREATE** — PATCH endpoint |
| `app/forge/page.tsx` | **MODIFY** — route tactical to /editor after done |
