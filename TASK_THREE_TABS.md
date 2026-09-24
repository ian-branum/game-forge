# TASK: Three-Tab Dashboard + Clone Model Overhaul

## Overview

Refactor the dashboard from two tabs (`MY GAMES` / `MARKETPLACE`) to three tabs (`PLAY` / `BUILD` / `BUY`), and update the clone flow and permission model to match the new design.

---

## 1. Tab Definitions

### PLAY tab
- Shows every game the current user can play, in a **table** layout.
- Columns: **Type** (emoji + label), **Title**, **Description**, **Creator**, **Created**
- Sources (union):
  1. Scenarios where `userId = me` (games I created or forked)
  2. Scenarios where I have a `PLAY` or `CLONE` license (originals I purchased or cloned from)
- Clicking the row (or a PLAY button) navigates to `/play/[id]`
- No modify/edit actions here — pure play access only
- No filter/archived toggle needed — show all active (non-archived)

### BUILD tab
- **Exactly like the current MY GAMES tab** — no changes to its UI or data
- Shows scenarios where `userId = me` (games I created + forks I own)
- Includes the existing ACTIVE/ARCHIVED toggle, category filter, MODIFY modal, all columns including VERSIONS and VISIBILITY

### BUY tab
- **Exactly like the current MARKETPLACE tab** — no changes to its UI or data
- Shows other people's public games available for purchase/clone
- Keep all existing filters, search, sort, card UI, buy/try/clone buttons

---

## 2. Tab Bar Change

Current:
```
[ MY GAMES ] [ MARKETPLACE ]
```

New:
```
[ PLAY ] [ BUILD ] [ BUY ]
```

Update the `Tab` type:
```ts
type Tab = "play" | "build" | "buy";
```

Default tab on load: `"play"`

---

## 3. Clone Flow — Two Records, Not One

**Current behavior:** Clone creates one forked scenario in user's account.

**New behavior:** Clone creates TWO things atomically:

### 3a. PLAY license on the original
- Upsert a `ScenarioLicense` row: `{ userId, scenarioId: source.id, type: "PLAY" }`
- This gives the cloner live access to the original (always the current version)
- This is what appears in their Play tab under the original creator's name

### 3b. Forked scenario in Build
- Create a new `Scenario` row as today, with:
  - `title`: `"[OriginalTitle] (cloned)"`  ← change from current `"Remix: [title]"`
  - `isPublic: false` (private by default)
  - `isClonable: false` (not clonable by default)
  - `userId`: cloner's user ID (they own the fork)
  - `parentScenarioId`: original scenario ID
  - All other fields copied from source

Both operations should succeed or fail together (use `prisma.$transaction`).

---

## 4. DB Schema Changes

Add two new Boolean fields to the `Scenario` model in `prisma/schema.prisma`:

```prisma
isClonable          Boolean @default(false)
clonesMayRepublish  Boolean @default(true)
```

Run `npx prisma migrate dev --name add_clone_permission_flags` after editing schema.

**Field semantics:**
- `isClonable`: Creator allows others to fork this game. Only show CLONE button in Buy tab if `isClonable = true`. Default `false` — opt-in only.
- `clonesMayRepublish`: Creator allows forked copies to be made public. Enforced server-side on publish. Default `true`.

---

## 5. Publish Section — Build Modal Changes

Add two new checkboxes in the **PUBLISH TO MARKETPLACE** section of `ModifyModal` (only shown when `isOwner`):

```
☐ Make public          — visible in Buy tab / other users can see it
☐ Allow cloning        — others can fork this game (isClonable)
  ☐ Allow clones to be republished  — shown only when cloning is enabled (clonesMayRepublish)
```

The existing `isPublic` checkbox maps to `Make public`.
New: `isClonable` checkbox for "Allow cloning".
New: `clonesMayRepublish` checkbox, only visible when `isClonable = true`.

Add helper text under `clonesMayRepublish`:
> "If unchecked, players who clone this game cannot publish their fork publicly."

Update the **Publish API** (`PATCH /api/scenarios/[id]/publish`) to accept and persist `isClonable` and `clonesMayRepublish`.

---

## 6. Republish Guard (Server-Side)

In `PATCH /api/scenarios/[id]/publish`:

When `isPublic: true` is being set on a scenario that has a `parentScenarioId`:
1. Fetch `parentScenario = await prisma.scenario.findUnique({ where: { id: scenario.parentScenarioId } })`
2. If `parentScenario.clonesMayRepublish === false`, return:
   ```json
   { "error": "The original creator has not permitted clones of this game to be published." }
   ```
   with status `403`.

---

## 7. Buy Tab — Show Clone Button Conditionally

In `MarketplaceCard`, only render the CLONE purchase button when `s.isClonable === true`.

Update the `MarketplaceScenario` interface to include:
```ts
isClonable: boolean;
clonesMayRepublish: boolean;
```

Update `GET /api/marketplace` to include `isClonable` in the select and response.

---

## 8. Attribution Chain (Existing — Preserve)

The lineage chain already exists in `MarketplaceCard`. No changes needed here. It is already non-removable and displayed permanently on forked listings. This satisfies the attribution requirement discussed in design.

---

## 9. API: Scenarios GET — Play Tab Query

Add a new query endpoint or extend `GET /api/scenarios` to support `?mode=play`:

When `mode=play`:
- Return all scenarios where `userId = me` (my own, including forks)
- UNION with all scenarios where I have a `PLAY` or `CLONE` license (the originals)
- Fields needed: `id`, `title`, `description`, `category`, `creator`, `createdAt`
- No versions, no modify data — lean payload

Implementation approach:
```ts
// My own scenarios
const mine = await prisma.scenario.findMany({ where: { userId, archived: false }, select: { ... } });

// Licensed originals
const licenses = await prisma.scenarioLicense.findMany({ where: { userId }, select: { scenarioId: true } });
const licensedIds = licenses.map(l => l.scenarioId);
const licensed = licensedIds.length > 0
  ? await prisma.scenario.findMany({ where: { id: { in: licensedIds }, archived: false }, select: { ... } })
  : [];

// Merge, deduplicate by id
const all = [...mine, ...licensed].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
```

Or handle in a single route file — the important thing is the data is correct.

---

## 10. Files to Change

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Three tabs, Play tab table, wire new state |
| `app/api/scenarios/route.ts` | Support `?mode=play` query |
| `app/api/scenarios/[id]/publish/route.ts` | Accept `isClonable`, `clonesMayRepublish`; add republish guard |
| `app/api/marketplace/route.ts` | Include `isClonable` in response |
| `app/api/marketplace/[id]/clone/route.ts` | Two-record clone (PLAY license + fork) |
| `prisma/schema.prisma` | Add `isClonable`, `clonesMayRepublish` fields |

---

## Acceptance Criteria

1. Dashboard has exactly three tabs: PLAY, BUILD, BUY — default lands on PLAY
2. Play tab shows table with Type, Title, Description, Creator, Created — clicking navigates to `/play/[id]`
3. Play tab shows user's own games AND games they have a license for (both PLAY and CLONE license)
4. Build tab is functionally identical to current MY GAMES — all features intact
5. Buy tab is functionally identical to current MARKETPLACE — all features intact, but CLONE button only appears when `isClonable = true`
6. Cloning a game atomically creates: PLAY license on original + forked scenario titled `"[Title] (cloned)"`
7. Forked scenario is private by default, `isClonable = false` by default
8. Publish modal in Build tab has `isClonable` and `clonesMayRepublish` checkboxes
9. Server rejects publishing a fork when `parentScenario.clonesMayRepublish = false`
10. Prisma migration runs cleanly with no data loss (both new fields have safe defaults)

---

## Style Conventions

- `"use client"` at top of client components
- Dark bg `#05071a`, Orbitron font via `font-orbitron` class
- Existing PILL_ACTIVE / PILL_INACTIVE constants for tab styling
- Keep all existing animations, hover states, and modal behaviors intact
