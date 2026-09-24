# TASK: Free "Broken? Fix it" Regenerate

## Overview

Add a free self-reported "game is broken" regenerate — separate from the paid regenerate button. One free fix per scenario, capped at 3 per user per day. Everything else (codeModify, regenerate) unchanged.

---

## Pricing changes (`lib/pricing.ts`)

Flatten all costs to the same rate. Regenerate should cost the same as forge/modify. Update `CREDIT_COSTS`:

```ts
export const CREDIT_COSTS = {
  forge: {
    sandbox:   3,
    tactical:  3,
    narrative: 4,
  },
  regenerate: {
    sandbox:   3,   // was 2 — now matches forge
    tactical:  3,   // was 2
    narrative: 4,   // was 3
  },
  codeModify: {
    sandbox:   3,   // was 1 — now matches forge
    tactical:  3,   // was 1
    narrative: 4,   // was 2
  },
} as const;
```

Also add to `FREEMIUM`:
```ts
freeFixesPerDay: 3,       // max free "broken" fixes per user per 24h
```

---

## DB: track free fix usage

Add a field to `Scenario` to record whether the free fix has been used:

```prisma
// In prisma/schema.prisma, inside model Scenario:
freeFixUsed Boolean @default(false)
```

Generate and run migration:
```bash
npx prisma migrate dev --name add_free_fix_used
```

No new model needed — the per-user daily cap is enforced at query time (count CreditTransactions with reason="freeFix" in last 24h).

---

## New API route: `POST /api/scenarios/[id]/freefix`

Create `/app/api/scenarios/[id]/freefix/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getServerPlugin } from "@/games/server-registry";
import { FREEMIUM } from "@/lib/pricing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;

  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scenario.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check: free fix already used for this scenario
  if (scenario.freeFixUsed) {
    return NextResponse.json(
      { error: "Free fix already used for this game." },
      { status: 402 }
    );
  }

  // Check: per-user daily cap
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fixesToday = await prisma.creditTransaction.count({
    where: { userId, reason: "freeFix", createdAt: { gte: since } },
  });
  if (fixesToday >= FREEMIUM.freeFixesPerDay) {
    return NextResponse.json(
      { error: `Free fix limit reached (${FREEMIUM.freeFixesPerDay} per day).` },
      { status: 402 }
    );
  }

  const serverPlugin = getServerPlugin(scenario.category);
  if (!serverPlugin) return NextResponse.json({ error: "Unknown category" }, { status: 400 });

  // Build chained prompt (same as regenerate route)
  const versions = await prisma.gameVersion.findMany({
    where: { scenarioId: id },
    orderBy: { versionNum: "asc" },
    select: { versionNum: true, prompt: true },
  });

  const chainedPrompt = [
    scenario.prompt,
    ...versions.map((v) => `[Modification ${v.versionNum}]: ${v.prompt}`),
  ].join("\n");

  let payload: unknown;
  try {
    payload = await serverPlugin.generate(chainedPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const nextVersionNum = versions.length > 0 ? versions[versions.length - 1].versionNum + 1 : 1;
  const regenerateLabel = versions.length > 0
    ? `REGENERATE (free fix): ${versions[versions.length - 1].prompt}`
    : `REGENERATE (free fix): ${scenario.prompt}`;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.gameVersion.create({
      data: {
        scenarioId: id,
        versionNum: nextVersionNum,
        prompt: regenerateLabel,
        payload: payload as object,
      },
      select: { id: true, versionNum: true, prompt: true, createdAt: true },
    });

    await tx.scenario.update({
      where: { id },
      data: {
        payload: payload as object,
        activeVersionId: created.id,
        freeFixUsed: true,        // mark used — one per scenario
      },
    });

    // Record as $0 transaction so the daily cap query works
    await tx.creditTransaction.create({
      data: { userId, amount: 0, reason: "freeFix" },
    });

    return created;
  });

  return NextResponse.json({ ok: true, version });
}
```

---

## Dashboard UI changes (`app/dashboard/page.tsx`)

### 1. Update hardcoded costs in `MODIFY_COSTS`

```ts
const MODIFY_COSTS: Record<string, { codeModify: number; regenerate: number }> = {
  sandbox:   { codeModify: 3, regenerate: 3 },
  tactical:  { codeModify: 3, regenerate: 3 },
  narrative: { codeModify: 4, regenerate: 4 },
};
```

### 2. Add `freeFixUsed` to the scenario type

Add `freeFixUsed: boolean` to the local `Scenario` type/interface used in this file.

### 3. Pass `freeFixUsed` from the DB query

The dashboard page fetches scenarios from the DB — make sure `freeFixUsed` is included in the select/include.

### 4. Add "🔧 Broken? Fix it" button in `ModifyModal`

In the modify controls section (where the mode toggle and buttons live), add a new section **below** the existing mode toggle and above the textarea. Only show it if `freeFixUsed === false`:

```tsx
{/* Free fix — only shown if not yet used */}
{!scenario.freeFixUsed && (
  <div className="mb-4 rounded-lg p-3" style={{ background: "#0a1020", border: "1px solid #1e2a4a" }}>
    <p className="text-gray-500 text-xs mb-2">
      Game not rendering correctly? Get one free regenerate on us.
    </p>
    <button
      onClick={handleFreeFix}
      disabled={working}
      className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-lg transition disabled:opacity-40"
      style={{ background: "#16213022", border: "1px solid #22c55e66", color: "#22c55e", minHeight: "44px" }}>
      🔧 BROKEN? FIX IT — FREE
    </button>
  </div>
)}
```

### 5. Add `handleFreeFix` function in `ModifyModal`

```ts
const handleFreeFix = async () => {
  setWorking(true);
  setModifyError("");
  try {
    const res = await fetch(`/api/scenarios/${scenario.id}/freefix`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) { setModifyError(data.error ?? "Free fix not available"); return; }
    if (!res.ok) { setModifyError(data.error ?? "Fix failed"); return; }
    const newVersion = data.version as GameVersion | undefined;
    if (newVersion) {
      const updated = [...versions, newVersion];
      setVersions(updated);
      setActiveVersionId(newVersion.id);
      onModified({
        ...scenario,
        title,
        description: description.trim() || null,
        activeVersionId: newVersion.id,
        versions: updated,
        isPublic: pubPublic,
        freeFixUsed: true,   // hide the button immediately after use
      });
    }
  } catch {
    setModifyError("Something went wrong. Please try again.");
  } finally {
    setWorking(false);
  }
};
```

---

## Scope
- `lib/pricing.ts` — flatten costs, add `freeFixesPerDay`
- `prisma/schema.prisma` — add `freeFixUsed Boolean @default(false)` to `Scenario`
- `app/api/scenarios/[id]/freefix/route.ts` — new route (create file)
- `app/dashboard/page.tsx` — updated costs, freeFixUsed in type/query, new button + handler

## Acceptance
- Generate, modify, regenerate all cost 3 credits (sandbox/tactical), 4 (narrative) — matching forge cost
- "🔧 Broken? Fix it — FREE" button appears in the modify modal for any scenario where `freeFixUsed = false`
- Clicking it regenerates at 0 credits, sets `freeFixUsed = true`, button disappears
- Second click attempt on same scenario returns 402 "Free fix already used"
- After 3 free fixes in 24h, returns 402 "Free fix limit reached"
- Paid regenerate still works exactly as before — the new button is additive

## Notes
- The "broken" framing is intentional — it's a self-reported label, not enforced. The friction of the label + the 1-per-scenario + 3-per-day caps are sufficient abuse prevention.
- No time window logic needed — the one-per-scenario cap is the primary guard.
- Button color: green (`#22c55e`) to visually distinguish from the blue modify/regenerate controls.
