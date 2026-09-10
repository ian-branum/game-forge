# TASK: Game Versions — Modify execution, version history, active version, delete

## What's already done (do NOT redo)
- `GameVersion` table added to Prisma schema and pushed to DB
- `Scenario` now has `activeVersionId String?` (FK → GameVersion, SetNull on delete)
- All 7 existing scenarios migrated: each has a v1 GameVersion, `activeVersionId` set
- Prisma client regenerated

## Schema reference
```prisma
model Scenario {
  id              String        @id @default(cuid())
  userId          String
  category        String
  title           String
  prompt          String        // always the original prompt
  payload         Json          // denormalized cache of active version's payload
  shareToken      String        @unique @default(cuid())
  createdAt       DateTime      @default(now())
  archived        Boolean       @default(false)
  isPublic        Boolean       @default(false)
  priceToPlay     Int           @default(0)
  priceToClone    Int           @default(0)
  activeVersionId String?

  user          User          @relation(...)
  versions      GameVersion[]
  activeVersion GameVersion?  @relation("ScenarioActiveVersion", ...)
}

model GameVersion {
  id         String   @id @default(cuid())
  scenarioId String
  versionNum Int
  prompt     String
  payload    Json
  createdAt  DateTime @default(now())

  scenario  Scenario
  activeFor Scenario[] @relation("ScenarioActiveVersion")

  @@unique([scenarioId, versionNum])
}
```

---

## Change 1: Modify route — actually run the generator

**File:** `app/api/scenarios/[id]/modify/route.ts`

Replace the current stub (which only pushes to `modificationPrompts`) with real generation:

1. Auth + owner check (existing)
2. Body: `{ modificationPrompt: string }`
3. Deduct credits same as initial forge (use `GENERATION_COSTS[scenario.category]`)
4. Build compound prompt:
   ```ts
   // Fetch all existing versions ordered by versionNum asc
   const versions = await prisma.gameVersion.findMany({
     where: { scenarioId: id },
     orderBy: { versionNum: "asc" },
     select: { prompt: true },
   });
   const chainedPrompt = [
     ...versions.map((v, i) => `[Version ${i + 1}]: ${v.prompt}`),
     `[Modification]: ${modificationPrompt}`,
   ].join("\n");
   ```
5. Run the appropriate generator with `chainedPrompt` (same switch as `/api/generate`)
6. Determine next `versionNum = versions.length + 1`
7. In a `prisma.$transaction`:
   - Create `GameVersion` with `{ scenarioId, versionNum, prompt: modificationPrompt, payload }`
   - Update `Scenario`: `{ payload: newPayload, activeVersionId: newVersion.id }`
   - Decrement user credits
   - Create CreditTransaction (reason: `"modification"`)
8. Return `{ ok: true, version: { id, versionNum, prompt, createdAt } }`

Import generators from `@/lib/generators/*` — same pattern as the generate route.

---

## Change 2: New route — DELETE a version

**File:** `app/api/scenarios/[id]/versions/[versionId]/route.ts`

`DELETE` method:

1. Auth + owner check
2. Fetch all versions for this scenario
3. Block if it's the last version (return 400: `"Cannot delete the only version"`)
4. Delete the GameVersion
5. If deleted version was the active version:
   - Auto-promote: find the version with the highest `versionNum` among remaining, set `scenario.activeVersionId` to it, update `scenario.payload` to its payload
6. Return `{ ok: true, newActiveVersionId: string | null }`

---

## Change 3: New route — Set active version

**File:** `app/api/scenarios/[id]/versions/[versionId]/route.ts` (same file, `PATCH` method)

`PATCH` method:

1. Auth + owner check
2. Verify the GameVersion belongs to this scenario
3. Update `scenario.activeVersionId = versionId` and `scenario.payload = version.payload`
4. Return `{ ok: true }`

---

## Change 4: GET /api/scenarios — include versions

**File:** `app/api/scenarios/route.ts`

Add `versions` to the select:
```ts
versions: {
  select: { id: true, versionNum: true, prompt: true, createdAt: true },
  orderBy: { versionNum: "asc" },
},
```
Also add `activeVersionId: true` to the select.

---

## Change 5: Dashboard UI

**File:** `app/dashboard/page.tsx`

### Interface updates
```ts
interface GameVersion {
  id: string;
  versionNum: number;
  prompt: string;
  createdAt: string;
}

interface ScenarioSummary {
  // existing fields...
  activeVersionId: string | null;
  versions: GameVersion[];
}
```

### "YOUR PROMPTS" section — replace with version list

Each version is a row. For owners, each row also has controls. Layout per version:

```
[v1]  "original prompt text"                    [SET ACTIVE] [🗑]
[v2]  "modification prompt text"  ← ACTIVE      [SET ACTIVE] [🗑]
```

- Version number badge: `font-orbitron text-xs` tinted `meta.color`, e.g. "V1", "V2"
- Prompt text: italic `text-gray-300 text-sm`
- Active indicator: a small pill `font-orbitron text-[10px] tracking-widest` with green glow: "● ACTIVE"
  - Show on the row whose `id === selected.activeVersionId`
- **SET ACTIVE button** (owners only, not shown on already-active version):
  - `font-orbitron text-[10px] tracking-widest px-2 py-1 rounded`
  - Style: `background: meta.color + "22"`, `border: 1px solid meta.color + "66"`, `color: meta.color`
  - On click: PATCH `/api/scenarios/[id]/versions/[versionId]`
  - On success: update `selected.activeVersionId` locally
- **Delete button** (owners only):
  - `text-xs px-1.5 py-0.5 rounded` red, opacity 0.4 → 1 on hover
  - Disabled + hidden if it's the only version
  - On click: DELETE `/api/scenarios/[id]/versions/[versionId]`
  - On success: remove version from local list; if `newActiveVersionId` returned, update `selected.activeVersionId`
  - Optimistic update: remove row immediately, revert on error

### Modify form

Keep the existing MODIFY textarea and button below the version list.
- On submit: POST to `/api/scenarios/[id]/modify` (now does real generation)
- Show a loading state: disable button, show "FORGING…" text
- On success: response returns `{ ok, version }` — append the new version to `selected.versions` and set `selected.activeVersionId = version.id`
- On 402 (insufficient credits): show "Not enough credits" in the error slot
- On error: existing error display

### State additions needed
```ts
const [versions, setVersions] = useState<GameVersion[]>([]);
const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
```

Seed these in `selectScenario`:
```ts
setVersions(s.versions ?? []);
setActiveVersionId(s.activeVersionId ?? null);
```

Use local state (`versions` / `activeVersionId`) for all rendering and updates in the detail panel — don't re-fetch the full list on every version action.

---

## Files to edit
- `app/api/scenarios/[id]/modify/route.ts` — replace stub with real generation
- `app/api/scenarios/route.ts` — add versions + activeVersionId to select
- `app/dashboard/page.tsx` — version list UI, state, handlers

## Files to create
- `app/api/scenarios/[id]/versions/[versionId]/route.ts` — DELETE + PATCH

## Do NOT
- Re-run `prisma db push` or `prisma generate`
- Modify `prisma/schema.prisma`
- Touch game component files
- Install new dependencies
- Change `/play/[id]/page.tsx` — it already reads `scenario.payload` which we keep in sync

## Style conventions
- `"use client"` at top of client components
- Dark bg `#05071a`, Orbitron font via `font-orbitron`
- TypeScript strict — no `any`, proper interfaces
- Tailwind + inline `style={}` for dynamic colors
