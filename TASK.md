# TASK: game-forge.ai — Phase 1 (Framework) + Phase 2 (Tactical)

## Overview

Build the complete framework for game-forge.ai — a platform where users describe a game scenario in plain English, AI generates a bespoke playable game, and they play it in the browser. Then wire up the existing Squad Leader tactical engine to the framework as the first live category.

The repo is at `/home/agentuser/game-forge`. The app is a Next.js 16 / React 19 / TypeScript / Tailwind 4 project deployed on Vercel.

---

## Phase 1 — Framework

### 1.1 Install dependencies

```bash
cd /home/agentuser/game-forge
npm install next-auth@5 @auth/prisma-adapter @prisma/client prisma
npx prisma init
```

### 1.2 Prisma DB Schema

Create `/home/agentuser/game-forge/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  credits       Int       @default(3)   // 3 free credits on signup
  accounts      Account[]
  sessions      Session[]
  scenarios     Scenario[]
  transactions  CreditTransaction[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model Scenario {
  id          String   @id @default(cuid())
  userId      String
  category    String   // "tactical" | "trivia" | "word" | etc.
  title       String
  prompt      String
  payload     Json     // category-specific ScenarioDefinition
  shareToken  String   @unique @default(cuid())
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CreditTransaction {
  id        String   @id @default(cuid())
  userId    String
  amount    Int      // positive = credit, negative = debit
  reason    String   // "signup_bonus" | "stripe_purchase" | "generation"
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Run: `cd /home/agentuser/game-forge && npx prisma generate && npx prisma db push`

### 1.3 Environment variables

Create `/home/agentuser/game-forge/.env.local` with the values from the build coordinator.

Required vars:
```
DATABASE_URL=<from coordinator>
NEXTAUTH_SECRET=<from coordinator>
NEXTAUTH_URL=https://game-forge.ai
DEEPSEEK_API_KEY=<from coordinator>
STRIPE_SECRET_KEY=<from coordinator>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from coordinator>
STRIPE_WEBHOOK_SECRET=<from coordinator — add after first deploy>
```

### 1.4 Auth — NextAuth v5

Create `/home/agentuser/game-forge/auth.ts`:
```ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({ clientId: process.env.GITHUB_ID!, clientSecret: process.env.GITHUB_SECRET! }),
    Google({ clientId: process.env.GOOGLE_ID!, clientSecret: process.env.GOOGLE_SECRET! }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

Create `/home/agentuser/game-forge/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

Create `/home/agentuser/game-forge/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 1.5 Landing page — `/app/page.tsx`

Replace the existing placeholder with a real landing page:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const CATEGORIES = [
  { id: "tactical",  label: "Tactical",   emoji: "⚔️",  desc: "Hex-based squad combat" },
  { id: "trivia",    label: "Trivia",      emoji: "🧠",  desc: "Quiz on any topic" },
  { id: "word",      label: "Word",        emoji: "📝",  desc: "Crosswords & word puzzles" },
  { id: "puzzle",    label: "Puzzle",      emoji: "🧩",  desc: "Logic & grid puzzles" },
  { id: "card",      label: "Card",        emoji: "🃏",  desc: "Solitaire & card games" },
  { id: "narrative", label: "Adventure",   emoji: "📖",  desc: "Text adventure & RPG" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CategoryId>("tactical");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!session) { signIn(); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Generation failed"); setLoading(false); return; }
      router.push(`/play/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
      <h1 className="font-orbitron text-5xl font-black tracking-widest text-white mb-3">
        GAME FORGE
      </h1>
      <p className="text-gray-400 text-lg max-w-xl mb-10">
        Describe any scenario. AI generates a unique game just for you.
      </p>

      {/* Category picker */}
      <div className="grid grid-cols-3 gap-3 mb-8 w-full max-w-xl">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex flex-col items-center p-3 rounded-lg border transition text-sm
              ${category === c.id
                ? "border-indigo-500 bg-indigo-900/40 text-white"
                : "border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-500"}`}
          >
            <span className="text-2xl mb-1">{c.emoji}</span>
            <span className="font-orbitron text-xs font-bold">{c.label}</span>
            <span className="text-xs text-gray-500 mt-0.5">{c.desc}</span>
          </button>
        ))}
      </div>

      {/* Prompt input */}
      <div className="w-full max-w-xl">
        <textarea
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none text-sm"
          rows={3}
          placeholder={
            category === "tactical"
              ? "e.g. US Marines assault a Japanese-held Pacific island, 1944..."
              : category === "trivia"
              ? "e.g. 10 questions about the Apollo moon missions..."
              : "Describe your game..."
          }
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleGenerate(); }}
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-orbitron text-sm tracking-widest transition"
        >
          {loading ? "GENERATING..." : session ? "FORGE GAME" : "SIGN IN TO FORGE"}
        </button>
        <p className="text-gray-600 text-xs mt-3">
          {session
            ? `${(session.user as any).credits ?? "?"} credits remaining`
            : "3 free games on signup · No credit card required"}
        </p>
      </div>

      {/* Demo link */}
      <div className="mt-12 border-t border-gray-800 pt-8 w-full max-w-xl">
        <p className="text-gray-500 text-sm mb-4">Try a demo scenario:</p>
        <a
          href="/play/normandy-demo"
          className="inline-block px-6 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-gray-400 hover:text-white text-sm font-orbitron tracking-widest transition"
        >
          ⚔️ NORMANDY DEMO
        </a>
      </div>
    </main>
  );
}
```

### 1.6 SessionProvider wrapper

Create `/home/agentuser/game-forge/app/providers.tsx`:
```tsx
"use client";
import { SessionProvider } from "next-auth/react";
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Update `/home/agentuser/game-forge/app/layout.tsx` to wrap with Providers.

### 1.7 `/api/generate` — AI generation endpoint

Create `/home/agentuser/game-forge/app/api/generate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTacticalScenario } from "@/lib/generators/tactical";

const GENERATION_COSTS: Record<string, number> = {
  tactical:  3,
  trivia:    1,
  word:      2,
  puzzle:    1,
  card:      2,
  narrative: 4,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt, category } = await req.json();
  if (!prompt || !category) {
    return NextResponse.json({ error: "Missing prompt or category" }, { status: 400 });
  }

  const cost = GENERATION_COSTS[category] ?? 2;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.credits < cost) {
    return NextResponse.json({ error: "Insufficient credits", needed: cost, have: user?.credits ?? 0 }, { status: 402 });
  }

  let payload: unknown;
  try {
    if (category === "tactical") {
      payload = await generateTacticalScenario(prompt);
    } else {
      return NextResponse.json({ error: `Category '${category}' not yet implemented` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Deduct credits + save scenario atomically
  const [scenario] = await prisma.$transaction([
    prisma.scenario.create({
      data: {
        userId: session.user.id,
        category,
        title: (payload as { title?: string }).title ?? "Untitled",
        prompt,
        payload: payload as object,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { credits: { decrement: cost } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId: session.user.id,
        amount: -cost,
        reason: "generation",
      },
    }),
  ]);

  return NextResponse.json({ id: scenario.id });
}
```

### 1.8 AI Tactical Generator

Create `/home/agentuser/game-forge/lib/generators/tactical.ts`:

This file calls DeepSeek to generate a tactical scenario using the Option C hybrid approach:
- AI outputs structured zone descriptors + unit placement
- A deterministic map builder converts zones → hex grid
- Returns a full `ScenarioDefinition` compatible with the existing engine

```ts
import type { ScenarioDefinition, Tile, TerrainType } from "@/lib/squad-leader/types";

interface ZoneDescriptor {
  name: string;           // e.g. "north", "center", "south", "east", "west"
  terrain: TerrainType;   // dominant terrain
  features?: string[];    // "road_ew", "road_ns", "buildings", "rubble"
  objective?: string;     // objective label if present
}

interface AIScenarioOutput {
  title: string;
  subtitle: string;
  briefing: string;
  zones: ZoneDescriptor[];  // 5-7 zones describing the battlefield
  alliedFaction: string;    // e.g. "US Marines"
  axisFaction: string;      // e.g. "Imperial Japanese Army"
  units: {
    id: string;
    name: string;
    faction: "allied" | "axis";
    type: "infantry" | "leader" | "mg" | "mortar" | "vehicle";
    attack: number;
    defense: number;
    movement: number;
    range: number;
    morale: number;
    pos: { row: number; col: number };
    emoji: string;
  }[];
  objectives: { pos: { row: number; col: number }; label: string }[];
  turnsTotal: number;
  alliedObjectivesNeeded: number;
  alliedWinCondition: string;
  axisWinCondition: string;
}

const SYSTEM_PROMPT = `You are a tactical wargame scenario designer. Given a battle description, output a JSON object describing the battlefield and units.

The map is 12 rows × 16 columns of hexagonal tiles.
Allied units start in the bottom rows (rows 8-11), Axis units in the top rows (rows 0-5).
Objectives are typically in the middle rows (rows 4-8).

Terrain types: "open", "road", "woods", "building", "rubble", "wall", "wheatfield"
Unit types: "infantry", "leader", "mg", "mortar", "vehicle"
Factions: "allied" or "axis"

Output ONLY valid JSON, no markdown, no explanation. Schema:
{
  "title": string,
  "subtitle": string,
  "briefing": string (2-3 paragraphs of flavor text),
  "zones": [
    { "name": "north", "terrain": "woods", "features": [], "objective": null },
    { "name": "center", "terrain": "building", "features": ["road_ew"], "objective": "Village Center" },
    { "name": "south", "terrain": "open", "features": [], "objective": null },
    { "name": "east", "terrain": "open", "features": ["road_ns"], "objective": null },
    { "name": "west", "terrain": "woods", "features": [], "objective": null }
  ],
  "alliedFaction": string,
  "axisFaction": string,
  "units": [ { "id", "name", "faction", "type", "attack", "defense", "movement", "range", "morale", "pos", "emoji" } ],
  "objectives": [ { "pos": { "row": number, "col": number }, "label": string } ],
  "turnsTotal": number (8-12),
  "alliedObjectivesNeeded": number,
  "alliedWinCondition": string,
  "axisWinCondition": string
}

Balance guidelines:
- 3-5 allied units, 3-5 axis units
- Always include 1 leader per side (morale 9, higher movement)
- Allied attack ratings 3-5, axis defense ratings 2-4
- MG teams: attack 6-7, range 6-7, movement 2-3
- Infantry: attack 3-5, defense 2-3, movement 4, range 4
- Morale 6-9 (veterans higher)
- 2-4 objectives, alliedObjectivesNeeded = ceil(objectives/2)`;

function buildMapFromZones(zones: ZoneDescriptor[]): Tile[][] {
  // 12 rows × 16 cols — start with open
  const map: Tile[][] = Array.from({ length: 12 }, () =>
    Array.from({ length: 16 }, () => ({ terrain: "open" as TerrainType }))
  );

  // Apply zone descriptors to map regions
  const zoneRegions: Record<string, { rows: [number, number]; cols: [number, number] }> = {
    north:  { rows: [0, 3],  cols: [0, 15] },
    south:  { rows: [8, 11], cols: [0, 15] },
    center: { rows: [4, 7],  cols: [4, 11] },
    east:   { rows: [2, 9],  cols: [11, 15] },
    west:   { rows: [2, 9],  cols: [0, 4] },
  };

  for (const zone of zones) {
    const region = zoneRegions[zone.name.toLowerCase()];
    if (!region) continue;
    const [r0, r1] = region.rows;
    const [c0, c1] = region.cols;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        map[r][c] = { terrain: zone.terrain };
      }
    }

    // Apply road features (east-west road at center row, north-south road at center col)
    if (zone.features?.includes("road_ew")) {
      const midRow = Math.floor((r0 + r1) / 2);
      for (let c = c0; c <= c1; c++) map[midRow][c] = { terrain: "road" };
    }
    if (zone.features?.includes("road_ns")) {
      const midCol = Math.floor((c0 + c1) / 2);
      for (let r = r0; r <= r1; r++) map[r][midCol] = { terrain: "road" };
    }
  }

  return map;
}

export async function generateTacticalScenario(prompt: string): Promise<ScenarioDefinition> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate a Squad Leader scenario for: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const raw: AIScenarioOutput = JSON.parse(data.choices[0].message.content);

  const map = buildMapFromZones(raw.zones ?? []);

  // Mark objective tiles on the map
  for (const obj of raw.objectives ?? []) {
    const { row, col } = obj.pos;
    if (map[row]?.[col]) {
      map[row][col] = { ...map[row][col], objective: true, objectiveHeldBy: null };
    }
  }

  return {
    id: "", // filled in by DB
    title: raw.title,
    subtitle: raw.subtitle,
    briefing: raw.briefing,
    map,
    units: raw.units,
    objectives: raw.objectives,
    turnsTotal: raw.turnsTotal ?? 10,
    alliedObjectivesNeeded: raw.alliedObjectivesNeeded ?? 2,
    alliedWinCondition: raw.alliedWinCondition,
    axisWinCondition: raw.axisWinCondition,
  };
}
```

### 1.9 Stripe — DEFERRED (stub only)

Stripe integration is deferred. Do NOT install the `stripe` package or `@stripe/stripe-js`.

Create stub routes so they don't 404:

Create `/home/agentuser/game-forge/app/api/checkout/route.ts`:
```ts
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Payments coming soon" }, { status: 503 });
}
```

Create `/home/agentuser/game-forge/app/api/webhooks/stripe/route.ts`:
```ts
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ received: true });
}
```

---

## Phase 2 — Tactical Engine Wiring

### 2.1 Dynamic play route `/play/[id]`

Create `/home/agentuser/game-forge/app/play/[id]/page.tsx`.

This page:
1. Fetches the scenario from DB by `id` (or `shareToken`)
2. Special-cases `id === "normandy-demo"` to use the hardcoded `normandyScenario`
3. Passes the `ScenarioDefinition` payload to the game engine component
4. Shows a briefing screen before the game starts (title, briefing text, "BEGIN" button)

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normandyScenario } from "@/lib/squad-leader/scenarios/normandy";
import TacticalGame from "@/components/TacticalGame";
import type { ScenarioDefinition } from "@/lib/squad-leader/types";

export default async function PlayPage({ params }: { params: { id: string } }) {
  let scenario: ScenarioDefinition;

  if (params.id === "normandy-demo") {
    scenario = normandyScenario;
  } else {
    const row = await prisma.scenario.findUnique({ where: { id: params.id } });
    if (!row || row.category !== "tactical") return notFound();
    scenario = row.payload as unknown as ScenarioDefinition;
    scenario.id = row.id;
  }

  return <TacticalGame scenario={scenario} />;
}
```

### 2.2 Extract TacticalGame component

Move the current `/app/play/page.tsx` content into `/home/agentuser/game-forge/components/TacticalGame.tsx`.

The component should:
- Accept `scenario: ScenarioDefinition` as a prop
- Show a full-screen briefing overlay on first load (scenario.title, scenario.briefing, "BEGIN MISSION" button)
- Use `initGame(scenario)` to start once the user clicks BEGIN
- Keep all existing hex rendering, unit display, combat log, phase controls exactly as-is
- Add a "Share" button in the header that copies `window.location.href` to clipboard
- The old `/app/play/page.tsx` can be deleted or replaced with a redirect to `/play/normandy-demo`

### 2.3 Credits display in nav

Create `/home/agentuser/game-forge/components/Nav.tsx` — a minimal top nav showing:
- "GAME FORGE" logo (links to `/`)
- If signed in: credits badge + "Buy Credits" button + sign out
- If not signed in: "Sign In" button

Add `<Nav />` to `app/layout.tsx`.

### 2.4 Buy Credits page (stub)

Create `/home/agentuser/game-forge/app/credits/page.tsx` — simple page showing the 3 credit pack options:
- Starter (10 credits, $2)
- Standard (50 credits, $8)
- Power (200 credits, $25)

Show a "Coming Soon" message on each Buy button — payments are not wired yet. The page exists so the nav can link to it.

---

## Style Conventions (apply everywhere)

- `"use client"` at top of all interactive components
- Dark bg `#05071a`, Orbitron font via `font-orbitron` class
- Glowing effects via `boxShadow` / Tailwind `shadow` utilities
- Mobile-first: on-screen buttons ≥ 44px touch targets
- Error states: always show user-friendly message, never crash silently
- All API routes return `{ error: string }` on failure with appropriate HTTP status

---

## Acceptance Criteria

### Phase 1
- [ ] Prisma schema applied to Neon DB (`npx prisma db push` succeeds)
- [ ] Landing page renders with category picker and prompt textarea
- [ ] Sign-in flow works (GitHub or Google OAuth)
- [ ] `/api/generate` accepts POST, calls DeepSeek, stores scenario, returns `{ id }`
- [ ] Credit deduction happens atomically with scenario creation
- [ ] `/api/checkout` returns 503 "coming soon" stub
- [ ] `/api/webhooks/stripe` returns 200 stub
- [ ] Credits page renders 3 pack options with "Coming Soon" on buy buttons
- [ ] `npm run build` passes with no TypeScript errors

### Phase 2
- [ ] `/play/normandy-demo` loads the hardcoded Normandy scenario
- [ ] `/play/[id]` loads a DB-stored scenario by ID
- [ ] Briefing screen shows before game starts
- [ ] Game plays identically to current `/play` page
- [ ] Share button copies URL to clipboard
- [ ] Nav shows credits count when signed in
- [ ] Credits page renders 3 pack options with working Stripe redirect

---

## Notes

- Do NOT break the existing Squad Leader engine — only move/wrap it, don't rewrite it
- The `ScenarioDefinition` type in `lib/squad-leader/types.ts` is the source of truth — do not modify it
- Run `npm run build` at the end and fix any TypeScript errors before finishing
- The `.env.local` file will be populated by the build coordinator with real keys before you run prisma push
