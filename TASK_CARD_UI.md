# TASK: Play Tab Cards + Buy Tab Fix + Creator Routing

## Overview

Three connected changes:
1. Replace the Play tab table with cards (similar style to Buy tab)
2. Fix the Buy tab — it's not showing published games correctly; redesign the card actions
3. Fix creator name clicks — currently 404; should route to Buy tab filtered by that creator

---

## 1. Play Tab — Replace Table with Cards

### Layout
Switch from `<table>` to a card grid (same `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` as the Buy tab).

### PlayCard component

Each card shows:
- **Type badge** — emoji + label (e.g. `⚔️ WW2 Tactical`), colored per category
- **Title** — `font-orbitron font-black text-white`
- **Description** — italic, gray, 2-line clamp
- **Creator line** — "By [Name]" where [Name] is a clickable link
  - Click routes to: `/dashboard?tab=buy&creator=<encodedUsername>` (NOT `/players/...`)
- **Lineage chain** — if the game has a `parentScenarioId`, show the inheritance chain below the creator line
  - Same style as existing `MarketplaceCard` lineage: `Original → Fork → ...` with clickable names
  - Each name in the chain routes to `/dashboard?tab=buy&creator=<encodedUsername>`
- **PLAY button** — bottom of card, full width, links to `/play/[id]`
  - Style: `background: ${meta.color}22`, `border: 2px solid ${meta.color}66`, `color: meta.color`

### Data for Play tab cards

The `/api/scenarios?mode=play` endpoint (added in previous task) returns the union of:
- My own scenarios (userId = me, including forks)
- Originals I have a PLAY or CLONE license for

For the Play tab cards, we need lineage data on licensed originals. Update `GET /api/scenarios?mode=play` to include:
```ts
select: {
  id: true,
  title: true,
  description: true,
  category: true,
  parentScenarioId: true,
  createdAt: true,
  user: { select: { displayName: true, name: true } },
}
```
And resolve the lineage chain for any scenario with a `parentScenarioId` (reuse the existing `buildLineage` function from `app/api/marketplace/route.ts` — move it to a shared lib if not already).

The two cards for a cloned game appear naturally:
- **Card A** — the original (from CLONE license): creator = original author, lineage = empty or original
- **Card B** — your fork (from "my own games"): creator = you, lineage chain shows derivation back to original

No special handling needed — the union produces both automatically.

### Interface update
```ts
interface PlayScenario {
  id: string;
  title: string;
  description: string | null;
  category: string;
  creator: string;
  createdAt: string;
  lineage: { displayName: string; scenarioId: string }[];
}
```

---

## 2. Buy Tab — Fix Visibility Bug + Redesign Card Actions

### 2a. Fix the visibility bug

**Symptom:** Buy tab shows owned/purchased games instead of (or in addition to) unowned published games.

**Investigate:** Check `GET /api/marketplace` — it currently filters `userId: { not: userId }` which should show other users' public games. Likely issues:
- The `isPublic` flag isn't being set when publishing (check `PATCH /api/scenarios/[id]/publish`)
- OR owned games aren't being excluded correctly (games where user has a PLAY/CLONE license should be hidden)
- OR the frontend is somehow loading the wrong data source

**Fix:**
In `GET /api/marketplace`, ensure:
1. `isPublic: true` — only public games
2. `archived: false`
3. `isDemo: false`
4. Exclude games where `userId === currentUser` (already done)
5. **Also exclude** games where the current user has an active `ScenarioLicense` (PLAY or CLONE):
```ts
const ownedLicenses = await prisma.scenarioLicense.findMany({
  where: { userId },
  select: { scenarioId: true },
});
const ownedIds = ownedLicenses.map(l => l.scenarioId);

// Add to where clause:
id: { notIn: ownedIds }
```

This ensures bought/cloned games disappear from Buy tab — they're in Play now.

### 2b. Redesign the BuyCard

Remove the current action button layout. New layout:

**TRY button** (shown only if `userStatus.canTrial` is true):
```
▶ TRY FREE  (freePlayLimit - trialCount remaining)
```

**BUY TO PLAY button** (always shown if not owned, regardless of price):
```
▶ BUY TO PLAY — X credits    (if priceToPlay > 0)
▶ GET TO PLAY — FREE          (if priceToPlay === 0)
```
- Clicking this calls `POST /api/marketplace/[id]/purchase` with `{ type: "PLAY" }`
- On success: game disappears from Buy tab (it's now owned → in Play tab)

**CLONE button** (only shown if `s.isClonable === true`):
```
⬇ CLONE — X credits          (if priceToClone > 0)
⬇ CLONE — FREE               (if priceToClone === 0)
```
- Clicking this calls `POST /api/marketplace/[id]/purchase` with `{ type: "CLONE" }`, then `POST /api/marketplace/[id]/clone`
- On success: game disappears from Buy tab

**No PLAY button on Buy tab cards.** If you want to play, go to the Play tab.

Button styles — keep consistent with existing aesthetic:
- TRY: subtle, `border: 1px solid ${meta.color}44`, smaller text
- BUY TO PLAY: primary action, `border: 2px solid ${meta.color}66`, `font-black`
- CLONE: secondary, `border: 1px solid #1e2a4a`, `color: #9ca3af`

All buttons min-height 44px for touch targets.

### 2c. Creator name routing on Buy tab cards

In `MarketplaceCard`, the `router.push(\`/players/${...}\`)` calls should be changed to:
```ts
router.push(`/dashboard?tab=buy&creator=${encodeURIComponent(creatorName)}`)
```
Same for lineage chain names.

---

## 3. Creator Filter via URL Params

### Dashboard reads URL params on load

In `DashboardPage`, on mount read `?tab=` and `?creator=` from `useSearchParams()`:

```ts
const searchParams = useSearchParams();

// On mount:
const tabParam = searchParams.get("tab");
if (tabParam === "buy" || tabParam === "play" || tabParam === "build") {
  setActiveTab(tabParam);
}
const creatorParam = searchParams.get("creator");
if (creatorParam) {
  setCreatorFilter(decodeURIComponent(creatorParam));
}
```

### New `creatorFilter` state

Add state:
```ts
const [creatorFilter, setCreatorFilter] = useState<string>("");
```

Pass `creatorFilter` to the marketplace API call:
```ts
if (creatorFilter.trim()) params.set("creator", creatorFilter.trim());
```

### Update `GET /api/marketplace`

Add support for `?creator=<displayName>` filter:
```ts
const creator = searchParams.get("creator")?.trim();
// ...
...(creator ? {
  user: {
    OR: [
      { displayName: { equals: creator, mode: "insensitive" } },
      { name: { equals: creator, mode: "insensitive" } },
    ]
  }
} : {})
```

### UI: show active creator filter on Buy tab

If `creatorFilter` is set, show a small pill in the Buy tab filters bar:
```
Games by: [CreatorName] ×
```
The `×` clears the filter (`setCreatorFilter("")`) and updates the URL (`router.replace("/dashboard?tab=buy")`).

---

## 4. Files to Change

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Add `PlayCard` component; replace table with card grid in Play tab; add `creatorFilter` state; read URL params on mount; update Buy tab card to `BuyCard` with new button layout; fix creator name routing |
| `app/api/scenarios/route.ts` | `?mode=play` — include `parentScenarioId` and lineage in response |
| `app/api/marketplace/route.ts` | Exclude licensed/owned games; add `?creator=` filter support; investigate and fix visibility bug |

---

## Acceptance Criteria

1. Play tab shows cards (not table), one card per game, two cards for cloned games (original + fork)
2. Each Play card has: type badge, title, description, creator (clickable), lineage chain (clickable), PLAY button
3. Creator/lineage clicks on Play tab route to `/dashboard?tab=buy&creator=<name>` — not a 404
4. Buy tab shows ALL public unowned games (not just unowned-and-unlicensed, but excluding games I have bought or cloned)
5. Buy tab cards have: TRY (if trials remain), BUY TO PLAY (always, price or FREE), CLONE (only if isClonable)
6. No PLAY button on Buy tab cards
7. Creator/lineage clicks on Buy tab also route to `/dashboard?tab=buy&creator=<name>`
8. Arriving at `/dashboard?tab=buy&creator=Alice` pre-filters the Buy tab to Alice's games with a clearable pill
9. Free games (priceToPlay=0) still require a click to "purchase" (creates the license record) — button reads "GET TO PLAY — FREE"

---

## Style Conventions
- `"use client"` at top
- Dark bg `#05071a`, Orbitron font via `font-orbitron`
- Existing `CATEGORY_META`, `PILL_ACTIVE`, `PILL_INACTIVE` constants — reuse
- Cards: `background: "#070d20"`, `border: "1px solid #1e2a4a"`, `borderRadius: "1rem"`
- Touch targets ≥ 44px
