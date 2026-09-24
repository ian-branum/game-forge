# TASK: Dashboard Redesign — My Games Tab

## Overview
Redesign the dashboard with pill-style tab navigation (MY GAMES | MARKETPLACE). For now, build MY GAMES fully; MARKETPLACE is a placeholder. Scope: games the current user created (userId === currentUserId only — purchased/cloned tracking comes later with marketplace).

Key changes to My Games:
- Active/Archived toggle (replaces the current all/mine/archived cycling button)
- New columns: Description, Creator (displayName) — remove Prompt column
- New column order: TYPE · TITLE · DESCRIPTION · CREATOR · CREATED · VERSIONS · VISIBILITY · ACTIONS
- Title and Description are editable inline in the game detail (modify) modal
- AI generates a short description at forge time (stored in DB)

---

## Schema (ALREADY DONE — do not touch prisma/schema.prisma or run any migrations)
- `Scenario.description String?` — already added and pushed

---

## Files to Modify / Create

### 1. `app/api/generate/route.ts` (MODIFY)
After `plugin.generate(prompt)` returns the payload, generate a short AI description.

Add a helper call after generation:

```typescript
// Generate a short description
async function generateDescription(prompt: string, title: string, gameType: string): Promise<string> {
  // Call DeepSeek with a small prompt
  // Returns 1-2 sentence description of the game for display to other users
  // Keep it punchy and informative: what type of game, what makes it unique
  // Max ~150 chars ideal
  // If it fails, fall back to: prompt.slice(0, 120) + (prompt.length > 120 ? "…" : "")
}
```

Use the same DeepSeek client already used in generators. Model: `deepseek-v4-flash`. Temp: 0.3. Max tokens: 80.

System prompt for description generation:
```
You are a game curator. Write a single punchy sentence (max 120 characters) describing this game for a marketplace listing. No preamble, no quotes, just the sentence.
```

User message: `Game type: ${gameType}. Title: "${title}". Created from prompt: "${prompt}"`

Store description in the scenario create call:
```typescript
prisma.scenario.create({
  data: {
    ...existing fields...
    description: generatedDescription,
  }
})
```

### 2. `app/api/scenarios/route.ts` (MODIFY)

**GET handler changes:**

a) Change the `where` clause to scope My Games to current user's own created scenarios:
```typescript
where: {
  userId: session.user.id,   // always filter to current user's games
  archived: archived ? true : false,
  ...(category ? { category } : {}),
  // remove isDemo exclusion if any — let owner see all their games
}
```
Remove the `mine` param logic — My Games is always the user's own.

b) Add `description` and user `displayName` to the select:
```typescript
select: {
  id: true,
  userId: true,
  title: true,
  description: true,       // ADD
  category: true,
  prompt: true,
  isPublic: true,
  priceToPlay: true,
  priceToClone: true,
  activeVersionId: true,
  versions: {
    select: { id: true, versionNum: true, prompt: true, createdAt: true },
    orderBy: { versionNum: "asc" },
  },
  user: {                  // ADD — join creator's displayName
    select: { displayName: true, name: true }
  },
  createdAt: true,
}
```

Return `creator` as `scenario.user.displayName ?? scenario.user.name ?? "Unknown"` in the response (map it before returning, don't expose raw user object).

**Add new PATCH endpoint** (or keep as separate file — see item 4 below) for title/description edits.

### 3. `app/api/scenarios/[id]/route.ts` (CREATE)
PATCH handler to update title and/or description for the scenario owner.

```typescript
// PATCH /api/scenarios/[id]
// Body: { title?: string, description?: string }
// Auth: must be owner (userId === session.user.id)
// Validation: title min 1 char if provided, description max 300 chars if provided
// Returns: { title, description }
```

### 4. `app/dashboard/page.tsx` (MODIFY — major rewrite of dashboard layout and logic)

#### Tab navigation (pill style, sticky below nav)
```
[ MY GAMES ]  [ MARKETPLACE ]
```
- MY GAMES selected = current view
- MARKETPLACE = placeholder "Coming Soon" state (grey pill, still clickable but shows placeholder content)
- Active tab: filled with `#4488ff22`, border `#4488ff66`, text `#4488ff`
- Inactive tab: transparent, border `#1e2a4a`, text `#6b7280`

#### My Games view

**Top bar (below tabs):**
- Category filter dropdown (keep as-is)
- Active/Archived toggle — two pill buttons side by side: `ACTIVE` | `ARCHIVED`
  - Active selected = blue, Archived selected = amber (#f59e0b)
- Remove the old cycling filter button

**Table columns (in order):**
`TYPE` · `TITLE` · `DESCRIPTION` · `CREATOR` · `CREATED` · `VERSIONS` · `VISIBILITY` · `ACTIONS`

- **TYPE**: emoji + label (same as now)
- **TITLE**: bold orbitron, truncated, max-w-[180px]
- **DESCRIPTION**: gray italic text, truncated, max-w-[240px]; if null show "—"
- **CREATOR**: displayName, gray text, max-w-[120px], truncated
- **CREATED**: date (same as now)
- **VERSIONS**: count (same as now)
- **VISIBILITY**: badge (same as now)
- **ACTIONS**: PLAY · MODIFY · ARCHIVE/RESTORE (same logic as now, owners only for archive)

Remove the PROMPT column entirely.

#### Interface type update
```typescript
interface ScenarioSummary {
  id: string;
  userId: string;
  title: string;
  description: string | null;   // ADD
  creator: string;              // ADD (resolved displayName from API)
  category: string;
  prompt: string;
  isPublic: boolean;
  priceToPlay: number;
  priceToClone: number;
  activeVersionId: string | null;
  versions: GameVersion[];
  createdAt: string;
}
```

#### Marketplace placeholder
When MARKETPLACE tab is active, show:
```
[shield/sword icon or 🏪]
MARKETPLACE
Coming Soon — discover and clone games forged by other players.
```
Centered, gray, same empty-state visual style as "no games found".

### 5. `app/dashboard/page.tsx` — ModifyModal additions (MODIFY)

Add **editable Title and Description** fields at the top of the modal body (above "ORIGINAL PROMPT"):

```
TITLE
[editable input — prefilled with scenario.title]

DESCRIPTION  
[editable textarea, 2 rows — prefilled with scenario.description or empty]
[helper text: "Shown to other players in the marketplace"]
```

- Both fields editable by owner only (readonly for non-owners)
- Save button or auto-save on blur — PATCH to `/api/scenarios/[id]` with `{ title, description }`
- On success: call `onModified` with updated title/description so table row updates live
- Show a subtle "✓ SAVED" confirmation (same pattern as the existing pricing save indicator)

Keep all existing modal sections (ORIGINAL PROMPT, VERSION HISTORY, MODIFY, PRICING) intact below.

---

## Data Flow Summary
1. User forges game → `/api/generate` calls AI, generates description, stores in DB
2. Dashboard loads → `/api/scenarios` returns `description` + `creator` (displayName)
3. Table shows: TYPE · TITLE · DESCRIPTION · CREATOR · CREATED · VERSIONS · VISIBILITY · ACTIONS
4. User opens modal → can edit title + description → PATCH `/api/scenarios/[id]` → table updates live

---

## Style Conventions
- `"use client"` at top
- Dark bg `#05071a`, Orbitron font via `font-orbitron` class
- Pill tab active: `background: "#4488ff22", border: "1px solid #4488ff66", color: "#4488ff"`
- Pill tab inactive: `background: "transparent", border: "1px solid #1e2a4a", color: "#6b7280"`
- Archived toggle active color: `#f59e0b` (amber)
- Inputs/textareas: `background: "#0a1128", border: "1px solid #1e2a4a", color: "#e5e7eb", borderRadius: "0.5rem", padding: "0.5rem"`
- All truncation via `truncate` class + `max-w-[Xpx]` + `block`

## ACCEPTANCE
- Dashboard opens with MY GAMES tab active by default
- MARKETPLACE tab shows a coming-soon placeholder
- My Games shows only the current user's own created scenarios
- Table has correct column order with Description and Creator; Prompt column is gone
- Active/Archived toggle works correctly (no cycling — two explicit buttons)
- Modal allows editing title and description (owner only), saves on blur, updates table live
- New games forged get an AI-generated description stored in DB
- Existing games with null description show "—" in the table and an empty textarea in modal
- TypeScript clean, build passes

## CONTEXT
- Repo: /home/agentuser/game-forge
- Next.js 15 app router, TypeScript, Tailwind + inline styles
- DeepSeek API key in process.env.DEEPSEEK_API_KEY (check .env.local for exact key name)
- Look at games/sandbox/generator.ts for how DeepSeek is called — replicate that pattern for description generation
- Run `npm run build 2>&1 | tail -40` after implementing and fix any errors before reporting done
