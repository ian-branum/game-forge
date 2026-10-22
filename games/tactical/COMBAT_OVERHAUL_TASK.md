# TASK: Combat Overhaul + Editor/Palette Polish

Two areas of work: (1) engine combat mechanics overhaul, (2) editor/palette UI polish.
Branch: `ian-working`. Repo: `/home/agentuser/game-forge`.

---

## PART 1 — Combat Engine Overhaul

### 1A. 2D6 dice roll

Replace the current `Math.random() * 10` with two independent D6 rolls summed (range 2–12, bell curve).

```ts
// Before
const roll = Math.random() * 10 + att.attack + leaderBonus;

// After
function roll2D6(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}
const net = roll2D6() + att.attack + leaderBonus - defenseValue;
```

The combat resolution now uses `net` (attack roll minus defense) instead of comparing `roll` against `defenseValue + threshold`:

```ts
// Outcome thresholds (net = 2D6 + attack + leaderBonus − defense − terrainBonus − suppressedPenalty)
if (net >= 8)      → ELIMINATED
else if (net >= 5) → BROKEN result
else if (net >= 2) → SUPPRESSED result
else               → MISS
```

Note: "BROKEN result" and "SUPPRESSED result" are *outcomes from the roll* — the actual status change applied to the target depends on unit type (see 1B below).

---

### 1B. Unit type status progression

Add a helper to determine unit category:

```ts
// "squad" types can be broken; "team" types cannot
function isSquad(unit: Unit): boolean {
  return unit.type === "infantry"; // Rifle Squad, Assault Squad
}
// Teams: mg, mortar, leader, vehicle
```

**Squad status progression** (infantry type):
| Current Status | Roll Result | New Status |
|---|---|---|
| normal | suppressed | suppressed |
| normal | broken | broken |
| normal | eliminated | eliminated |
| suppressed | suppressed | broken *(fear escalates)* |
| suppressed | broken | broken |
| suppressed | eliminated | eliminated |
| broken | suppressed | broken *(stays broken)* |
| broken | broken | eliminated |
| broken | eliminated | eliminated |

**Team status progression** (mg, mortar, leader, vehicle):
| Current Status | Roll Result | New Status |
|---|---|---|
| normal | suppressed | suppressed |
| normal | broken | eliminated *(casualties they can't absorb)* |
| normal | eliminated | eliminated |
| suppressed | suppressed | suppressed *(re-pinned, stays suppressed)* |
| suppressed | broken | eliminated |
| suppressed | eliminated | eliminated |

Implement this as a pure function:

```ts
function applyResult(
  unit: Unit,
  result: "suppressed" | "broken" | "eliminated"
): UnitStatus {
  if (result === "eliminated") return "eliminated";

  if (isSquad(unit)) {
    if (result === "broken") {
      return unit.status === "broken" ? "eliminated" : "broken";
    }
    // suppressed result
    return unit.status === "suppressed" || unit.status === "broken" ? "broken" : "suppressed";
  } else {
    // team
    if (result === "broken") return "eliminated";
    // suppressed result
    return "suppressed"; // stays suppressed if already suppressed
  }
}
```

Replace the current inline if/else status-setting in `fireUnit` with `applyResult`.

---

### 1C. Terrain defense values

Update `terrainDefenseBonus` in `engine.ts`:

```ts
function terrainDefenseBonus(map: GameMap, pos: Pos): number {
  const tile = map[pos.row]?.[pos.col];
  if (!tile) return 0;
  switch (tile.terrain) {
    case "open":       return 0;
    case "road":       return 0;
    case "wheatfield": return 1;
    case "rubble":     return 2;
    case "woods":      return 3;
    case "building":   return 4;
    default:           return 0;
  }
}
```

Note: `"wall"` is removed as a terrain type (see Part 2). Default covers any legacy data.

---

### 1D. Assault Squad adjacency bonus

Add a check in `fireUnit`: if the attacker's `type === "assault"` (see 1F below) AND `hexDist(att.pos, tgt.pos) === 1`, add +2 to the net roll.

```ts
const assaultBonus = (att.type === "assault" && hexDist(att.pos, tgt.pos) === 1) ? 2 : 0;
const net = roll2D6() + att.attack + leaderBonus + assaultBonus - defenseValue;
```

---

### 1E. Leader targeting protection

In `getAttackableTargets`, add a filter: a leader cannot be targeted if there is any other non-eliminated friendly unit in the same hex.

```ts
// Inside the filter for targetable units:
if (u.type === "leader") {
  const sharedHex = state.units.some(
    other =>
      other.id !== u.id &&
      other.faction === u.faction &&
      other.status !== "eliminated" &&
      other.pos.row === u.pos.row &&
      other.pos.col === u.pos.col
  );
  if (sharedHex) return false; // leader is protected by stacked unit
}
```

---

### 1F. New unit type: "assault"

Add `"assault"` to `UnitType` in `types.ts`:

```ts
export type UnitType = "infantry" | "assault" | "leader" | "mg" | "mortar" | "vehicle";
```

Assault squads are classified as squads (`isSquad` returns true for `"assault"`), so they follow squad status progression (can be broken).

Update `UnitTypeSchema` in `schema.ts` to include `"assault"`.

---

### 1G. Default unit stats in generator

Update the tactical generator (`lib/generators/tactical.ts` or wherever unit defaults are set) to use the new roster and stats. When the AI generates units, these are the canonical base stats:

| Type | Attack | Defense | Range | Move | Morale | Notes |
|---|---|---|---|---|---|---|
| infantry | 4 | 8 | 4 | 4 | 7 | Rifle Squad |
| assault | 6 | 8 | 2 | 5 | 7 | Assault/SMG Squad |
| mg | 7 | 5 | 6 | 2 | 7 | MG Team |
| mortar | 5 | 6 | 8 | 2 | 6 | Mortar Team |
| leader | 1 | 8 | 2 | 5 | 9 | |

Instruct the AI (in the generator prompt) that:
- "wall" is not a valid terrain type — use rubble instead
- Unit types are: infantry, assault, mg, mortar, leader (no vehicle for now)
- Mortar teams use direct fire (LOS required) — no indirect fire

---

### 1H. LOS — update for wall removal

In `los.ts` and `types.ts`, remove `"wall"` from terrain handling. The current LOS logic doesn't explicitly handle wall (it falls through to the default "no block"), so this is mostly a cleanup — just ensure `"wall"` doesn't appear in any switch/case.

In `types.ts`, remove `"wall"` from the `TerrainType` union:

```ts
export type TerrainType =
  | "open"
  | "road"
  | "woods"
  | "building"
  | "rubble"
  | "wheatfield";
```

---

### 1I. Rally — remove broken state for teams

In `rallyUnit`, teams (non-squad types) can only rally from `"suppressed"`. Since they can never reach `"broken"`, no broken rally path is needed for them. But add a guard to be safe:

```ts
if (!isSquad(unit) && unit.status === "broken") {
  // shouldn't happen, but defensively reset to suppressed
  u.status = "suppressed";
  return { ...s, log: [`${u.name} reorganizes`, ...s.log] };
}
```

---

## PART 2 — Editor & Palette UI Polish

All changes in `games/tactical/ScenarioEditor.tsx` unless noted.

### 2A. Remove erasers from palette

Remove all eraser tool buttons from the palette (terrain eraser, unit eraser, objective eraser).

Replace eraser behavior with:
- **Terrain:** selecting "Open" terrain and painting achieves the same effect — no eraser needed
- **Units:** right-click on a hex removes a unit. If multiple units on the hex, remove the last-placed. On touch devices (detect via `'ontouchstart' in window`), use tap-and-hold (500ms `longpress`) to remove a unit from a hex.
- **Objectives:** same — right-click or tap-and-hold removes an objective from a hex

Prevent the browser context menu on right-click within the SVG map: `onContextMenu={e => e.preventDefault()}`.

---

### 2B. Smaller unit icons in palette

In the palette, unit buttons currently render NATO symbols at ~39×28px. Reduce to match the inventory panel size: `viewBox="0 0 36 26"` at 22×16px (same as inventory). This compresses the palette vertically.

---

### 2C. Remove "wall" terrain from palette

Remove the Wall entry from `TERRAIN_TOOLS`. The terrain type no longer exists.

---

### 2D. Building color — dark gray

In `TERRAIN_FILL` (both in `TacticalGame.tsx` and `ScenarioEditor.tsx` / `NATOSymbols.tsx` if duplicated), update building color:

```ts
building: "#3a3a3a",  // dark gray (was "#7a5c10")
```

---

### 2E. Map scales to fill available space

The hex map SVG currently renders at a fixed size. Make it scale to fill the available center column space.

Approach:
1. Compute the natural SVG dimensions from the grid (existing `svgWidth`/`svgHeight` calculation)
2. Wrap the SVG in a `div` that fills the center column (`flex-1 min-w-0`)
3. Use `viewBox` on the SVG with natural dimensions, and set `width="100%" height="100%"` with `preserveAspectRatio="xMidYMid meet"`
4. The SVG will scale up/down to fill the column while maintaining hex proportions and centering

This also benefits `TacticalGame.tsx` — apply the same treatment there if it doesn't already work this way.

---

### 2F. Update UNIT_TEMPLATES in editor

Update to include the new `assault` type and remove wall:

```ts
const UNIT_TEMPLATES = {
  allied: {
    infantry: { name: "Rifle Squad",  attack: 4, defense: 8, movement: 4, range: 4, morale: 7 },
    assault:  { name: "Assault Squad", attack: 6, defense: 8, movement: 5, range: 2, morale: 7 },
    mg:       { name: "MG Team",       attack: 7, defense: 5, movement: 2, range: 6, morale: 7 },
    mortar:   { name: "Mortar Team",   attack: 5, defense: 6, movement: 2, range: 8, morale: 6 },
    leader:   { name: "Leader",        attack: 1, defense: 8, movement: 5, range: 2, morale: 9 },
  },
  axis: {
    // identical stats, same generic names
    infantry: { name: "Rifle Squad",  attack: 4, defense: 8, movement: 4, range: 4, morale: 7 },
    assault:  { name: "Assault Squad", attack: 6, defense: 8, movement: 5, range: 2, morale: 7 },
    mg:       { name: "MG Team",       attack: 7, defense: 5, movement: 2, range: 6, morale: 7 },
    mortar:   { name: "Mortar Team",   attack: 5, defense: 6, movement: 2, range: 8, morale: 6 },
    leader:   { name: "Leader",        attack: 1, defense: 8, movement: 5, range: 2, morale: 9 },
  },
};
```

Unit order in palette: Rifle Squad, Assault Squad, MG Team, Mortar Team, Leader.

Update `UNIT_PALETTE` array to include `assault` type and match this order.

Also update `NATOSymbols.tsx`: add a NATO symbol for `assault` type. Visually it's the same rectangle-with-X as infantry but with an additional small slash or inner mark to differentiate — or simply use the same `NATOInfantry` symbol; the label "Assault" in the inventory is sufficient distinction. Your call on the symbol, keep it simple.

---

## File Summary

| File | Change |
|---|---|
| `games/tactical/engine/types.ts` | Add `"assault"` to UnitType; remove `"wall"` from TerrainType |
| `games/tactical/engine/engine.ts` | 2D6, applyResult(), assault bonus, leader protection, terrain values |
| `games/tactical/engine/los.ts` | Remove wall handling (cleanup only) |
| `games/tactical/engine/NATOSymbols.tsx` | Add assault symbol; update building color |
| `games/tactical/TacticalGame.tsx` | Update building color; map scales to fill space |
| `games/tactical/ScenarioEditor.tsx` | Remove erasers; smaller icons; remove wall; building color; map scaling; update UNIT_TEMPLATES |
| `games/tactical/schema.ts` | Add `"assault"` to UnitTypeSchema; remove `"wall"` from TerrainTypeSchema |
| `lib/generators/tactical.ts` | Update unit stats, remove wall from terrain list, add assault type |

---

## When Done

```
git add -A && git commit -m "feat: combat overhaul — 2D6, squad/team progression, assault type, leader protection, palette polish"
```

On `ian-working`. Do NOT push. Report back with summary and any deviations.
