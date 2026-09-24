# TASK: Marketplace Tab — Full Implementation

## Overview
Build the Marketplace tab on the dashboard. Users browse public games created by others, try them (free trial with session limits), and purchase either a Play license or Clone license using credits. Cloned games land in the user's My Games tab ready to modify and publish.

## Schema (ALREADY PUSHED — do not modify prisma/schema.prisma or run migrations)

### New columns on Scenario:
- `parentScenarioId String?` — direct parent clone source
- `originalScenarioId String?` — root ancestor (null = this is original)
- `freePlayLimit Int @default(3)` — 1 or 3 trial sessions
- `adventureSubtype String?` — "fixed" | "infinite" | "mystery" (narrative only)
- `trialStepLimit Int?` — mystery only, author-defined, null = TBD

### New tables:
- `ScenarioPlay { id, userId, scenarioId, count, updatedAt } @@unique([userId, scenarioId])`
- `ScenarioLicense { id, userId, scenarioId, type ("PLAY"|"CLONE"), amount, createdAt } @@unique([userId, scenarioId, type])`

### freePlayLimit by game type (set at publish time):
- sandbox → 3
- tactical → 1
- narrative/fixed → 1
- narrative/infinite → 3
- narrative/mystery → 1 (placeholder — mystery enforcement TBD)

---

## Files to Create / Modify

### 1. `app/api/marketplace/route.ts` (CREATE)
GET — returns public, non-archived, non-demo scenarios from OTHER users (not the current user's own).

```typescript
// Query:
where: {
  isPublic: true,
  archived: false,
  isDemo: false,
  userId: { not: session.user.id },
}
// Include: priceToPlay, priceToClone, freePlayLimit, adventureSubtype
// Join: user { displayName, name } → resolve as `creator`
// Join: parent { id, user { displayName, name } } → for attribution
// Join: originalScenario via originalScenarioId lookup (separate query if needed)
// Also return per-scenario: user's play count + licenses (so UI knows trial status)
```

Response shape per scenario:
```typescript
{
  id, title, description, category, creator,
  priceToPlay, priceToClone, freePlayLimit, adventureSubtype,
  isPublic, createdAt,
  versionCount: number,
  // Attribution chain: array of { displayName, scenarioId } from original → current
  lineage: Array<{ displayName: string; scenarioId: string }>,
  // Current user's trial/license status
  userStatus: {
    trialCount: number,       // plays so far
    hasPlayLicense: boolean,
    hasCloneLicense: boolean,
    canTrial: boolean,        // trialCount < freePlayLimit && no license
  }
}
```

Supports query params:
- `?category=sandbox|tactical|narrative` — filter by type
- `?sort=newest|popular` — newest = createdAt desc (default), popular = TODO (just use newest for now)
- `?q=searchterm` — title/description ILIKE search

### 2. `app/api/marketplace/[id]/purchase/route.ts` (CREATE)
POST — purchase a PLAY or CLONE license.

Body: `{ type: "PLAY" | "CLONE" }`

Logic:
1. Auth check
2. Load scenario — must be public, not owned by current user
3. Check if license already exists → 409 if so
4. Check buyer has enough credits (priceToPlay or priceToClone)
5. In a single `$transaction`:
   - Deduct credits from buyer
   - Credit credits to scenario owner
   - Create `ScenarioLicense` record
   - Create two `CreditTransaction` rows: buyer (negative, reason: `"play_purchase"` or `"clone_purchase"`), seller (positive, reason: `"sale"`)
6. Return `{ success: true, type }`

### 3. `app/api/marketplace/[id]/clone/route.ts` (CREATE)
POST — clone a scenario the user has a CLONE license for.

Logic:
1. Auth check
2. Load source scenario
3. Verify caller has CLONE license (or is not needed if priceToClone === 0 — free clone)
4. If priceToClone > 0 and no license → 402
5. Create new Scenario:
   ```typescript
   {
     userId: session.user.id,
     category: source.category,
     title: `Remix: ${source.title}`,
     prompt: source.prompt,
     payload: source.payload,         // copy active version payload
     description: source.description,
     parentScenarioId: source.id,
     originalScenarioId: source.originalScenarioId ?? source.id,
     freePlayLimit: source.freePlayLimit,
     adventureSubtype: source.adventureSubtype,
     isPublic: false,                 // owner publishes when ready
     priceToPlay: 0,
     priceToClone: 0,
   }
   ```
6. Return `{ id: newScenario.id }` — frontend redirects to dashboard My Games

### 4. `app/api/play/[id]/start/route.ts` (CREATE)
POST — called when a user starts playing a scenario. Enforces trial limits.

Logic:
1. Auth check
2. Load scenario
3. If owner → allow (no tracking)
4. Check for PLAY or CLONE license → allow (no tracking)
5. Look up `ScenarioPlay` record for [userId, scenarioId]
6. If `count >= freePlayLimit` → return 402 `{ trialExhausted: true, priceToPlay, priceToClone, title }`
7. Otherwise: upsert ScenarioPlay (increment count), return `{ allowed: true, trialCount: newCount, freePlayLimit }`

### 5. `app/dashboard/page.tsx` (MODIFY — add Marketplace tab content)

The tab shell is already built with MY GAMES and MARKETPLACE pills. Replace the MARKETPLACE placeholder with the real content.

#### Marketplace view structure:

**Filters bar** (when marketplace tab active):
- Category filter dropdown (same as My Games)
- Sort dropdown: "NEWEST" | "POPULAR" (popular = coming soon, just show newest for both)
- Search input: text field, debounced 400ms, queries `?q=`

**Game cards grid** (not a table — cards work better for browsing):
- 2 columns on desktop, 1 on mobile (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`)
- Each card:

```
┌─────────────────────────────────────────┐
│ [emoji] CATEGORY LABEL         [status] │  ← status: "OWNED" | "TRIAL X/3" | "FREE TRIAL"
│                                         │
│ TITLE (orbitron bold, white)            │
│ Description (gray, 2 lines max)         │
│                                         │
│ By PlayerName                           │
│ → Remixed from OriginalAuthor  (if any) │  ← clickable lineage
│                                         │
│ ─────────────────────────────────────── │
│ Play: 5 credits   Clone: 20 credits     │
│                        [TRY] [PURCHASE] │
└─────────────────────────────────────────┘
```

Card styles:
- bg: `#070d20`, border: `1px solid [categoryColor]33`
- hover: border brightens to `[categoryColor]66`, subtle glow
- "OWNED" badge: green pill `#22c55e`
- "TRIAL X/3" badge: amber pill showing `X/freePlayLimit` remaining (e.g. "2/3 left")
- "FREE" badge: blue pill when no trials used yet

**[TRY] button** behavior:
- Calls `POST /api/play/[id]/start`
- If allowed → navigate to `/play/[id]`
- If 402 trialExhausted → show inline purchase prompt on the card (replaces buttons with "Buy to keep playing" + price buttons)

**[PURCHASE] button** behavior (dropdown or two buttons):
- Show two options: "▶ Play — X credits" and "🔀 Clone — X credits"
- On click → call `POST /api/marketplace/[id]/purchase` with type
- On success → refresh card status; if CLONE also show "Clone to My Games" button
- If 0 credits price → button label changes to "FREE"

**Lineage display:**
```
By PlayerA → PlayerB → PlayerC
```
Each name is a `<button>` that opens a small popover/tooltip showing that player's other public games, OR just links to `/players/[displayName]` (placeholder page for now — just link, don't build the profile page yet).

#### Loading / empty states:
- Loading: same pulsing LOADING... as rest of app
- No results: "No games in the marketplace yet. Forge something and publish it!"
- Search no results: "No games match '[query]'"

### 6. `app/play/[id]/page.tsx` (MODIFY)
Add a trial gate: before rendering the game, call `POST /api/play/[id]/start`.

- If `{ allowed: true }` → render game as normal
- If `{ trialExhausted: true }` → show a gate screen (full page, same dark style):

```
[game emoji/category]
TRIAL ENDED

You've used all X free plays of "[Title]"

[▶ Buy to Play — X credits]   [🔀 Clone & Own — X credits]

Back to Marketplace
```

Gate screen should match site aesthetic. Orbitron font, dark bg, category color accents.

If the user is the owner or has a license, skip the gate entirely (the API returns `allowed: true`).

Note: the trial gate should NOT fire for the user's own games or demos.

### 7. `app/api/scenarios/[id]/publish/route.ts` (CREATE)
PATCH — owner sets `isPublic`, `priceToPlay`, `priceToClone`, `freePlayLimit`, `adventureSubtype`.
This replaces/supplements the existing visibility toggle for marketplace publishing.

Body:
```typescript
{
  isPublic: boolean,
  priceToPlay: number,
  priceToClone: number,         // must be >= priceToPlay (validate server-side)
  freePlayLimit: number,        // 1 or 3
  adventureSubtype?: string,    // required if category === "narrative"
}
```

Validation:
- priceToClone >= priceToPlay (error if not: "Clone price must be at least as high as play price")
- freePlayLimit must be 1 or 3
- adventureSubtype required for narrative

### 8. ModifyModal — Publish section (MODIFY `app/dashboard/page.tsx`)
Replace the current simple visibility toggle + pricing section in the modal with a proper **PUBLISH** section (owner only):

```
PUBLISH TO MARKETPLACE
[ ] Make public

[when public, show:]

  Price to Play:  [___] credits
  Price to Clone: [___] credits   (must be ≥ play price)
  
  Free trial:  ○ 1 session  ○ 3 sessions
  
  [narrative only:]
  Adventure type: ○ Fixed Story  ○ Infinite Replay  ○ Mystery
                                                      (step limit: coming soon)

  [SAVE PUBLISHING SETTINGS]   ✓ SAVED
```

Calls PATCH `/api/scenarios/[id]/publish` on save button click (not on blur — this is a deliberate publish action).

---

## Credit display update
After any purchase, the session credits count shown in the Nav should update. The Nav reads credits from the session — after purchase, call `update()` from `useSession()` to refresh session credits, OR just invalidate and let Next-Auth refresh naturally. Simplest: after purchase success, do `window.location.reload()` — acceptable for now.

---

## Style conventions
- `"use client"` at top of all client components
- Dark bg `#05071a`, Orbitron font
- Card grid not table (marketplace is for browsing, not managing)
- Category colors: sandbox `#4488ff`, tactical `#f97316`, narrative `#a855f7`
- All API errors surfaced as inline messages, no alerts/confirms
- Mobile friendly — cards stack to 1 column, touch targets ≥ 44px

## ACCEPTANCE
- Marketplace tab shows public games from other users
- Cards show title, description, creator, lineage attribution (clickable)
- Trial system enforces freePlayLimit per user per game (server-side)
- Play and Clone purchases deduct from buyer, credit to seller, atomic transaction
- Clone creates new scenario in buyer's My Games (parentScenarioId + originalScenarioId set)
- `/play/[id]` shows trial gate when exhausted, with purchase options
- Publish section in modal replaces old visibility+pricing UI
- priceToClone >= priceToPlay enforced server and client
- TypeScript clean, `npm run build` exits 0

## CONTEXT
- Repo: /home/agentuser/game-forge
- Next.js 15 app router, TypeScript, Tailwind + inline styles
- Prisma client at `@/lib/prisma`
- Auth: `import { auth } from "@/auth"` (server), `useSession()` (client)
- Read `app/dashboard/page.tsx` carefully — the tab shell is already built, add marketplace content to the MARKETPLACE tab branch
- Read `app/play/[id]/page.tsx` before modifying it
- Read `app/api/scenarios/route.ts` for query patterns
- Run `npm run build 2>&1 | tail -40` after implementing. Fix all errors before reporting done.
