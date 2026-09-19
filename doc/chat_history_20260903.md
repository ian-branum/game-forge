# Game-Forge Design Chat — 2026-09-03
**Group:** Game-Forge next steps  
**Participants:** Ian Branum, Chef (AI)

---

### 16:47 UTC — Ian Branum
> Hey Marta, hey Chef. Welcome to our new Telegram thread. Chef, Marta is new to this project. You have full access to the Game Forge repo. Please explain it to her.

---

### 16:47 UTC — Chef
Hey Marta! Welcome aboard 👋 Happy to walk you through it.

**Game Forge** — live at game-forge.ai — is an AI-powered game platform. The concept: you describe any scenario in plain English, the AI generates a unique playable game in seconds, and you play it right in the browser. No downloads, no installs.

Here's the stack and structure:

**Tech:** Next.js 16 / React 19 / TypeScript / Tailwind 4, deployed on Vercel. PostgreSQL via Neon (Prisma ORM). Auth via NextAuth v5 (Google + GitHub). AI generation via DeepSeek API. Stripe integration is stubbed out but not live yet.

**How it works end-to-end:**
1. User lands on the home page, picks a game category and types a prompt
2. Hits "Forge Game" → POST to `/api/generate`
3. API calls DeepSeek, which outputs a structured scenario definition (JSON)
4. Scenario saved to DB, credits deducted, user redirected to `/play/[id]`
5. The play page loads the scenario and runs the appropriate game engine in the browser

**Game engines live so far:**
- ⚔️ **Tactical** — hex-based squad combat (the main one, most developed). You get a generated battlefield, units (infantry, MG teams, leaders), objectives, morale system, line-of-sight, AI opponent. The Normandy demo is playable now.
- There are 6 planned categories total: Tactical, Trivia, Word, Puzzle, Card, Adventure — the others are on the roadmap

**Tactical engine specifics** (since that's the most built-out):
- 12×16 hex grid with cube-coordinate geometry
- Terrain types: open, woods, buildings, roads, rubble, wheatfields — each with different movement costs and cover
- AI describes the battlefield in "zone descriptors" (north: woods, center: village, etc.), then a deterministic map builder converts that into the actual hex grid. This hybrid approach avoids hallucinated terrain.
- Units have attack/defense/movement/range/morale stats; morale cascades through suppression → broken → eliminated
- Leader units provide bonuses to nearby units

**Auth + credits:**
- Sign up = 3 free credits
- Generation costs vary by category (tactical costs 3 credits, trivia 1, etc.)
- Credit purchase UI is stubbed with "Coming Soon" — Stripe wiring is the next big thing

**Repo structure:**
- `app/` — Next.js routes (page.tsx landing, forge/page.tsx for generation, play/[id]/page.tsx for game)
- `components/` — TacticalGame and Nav components
- `lib/squad-leader/` — the tactical engine (types, scenarios, generators)
- `lib/generators/tactical.ts` — DeepSeek prompt + zone → hex map builder
- `prisma/` — DB schema (User, Scenario, CreditTransaction)

What brings you to the project? Happy to go deeper on any piece of it.

---

### 17:10 UTC — Ian Branum
> Hey Marta, say hi to the chef

---

### 17:18 UTC — M
> Hi cheef

---

### 17:18 UTC — Chef
Hey Marta! 👋 Welcome to the team. Looking forward to building with you.

---

### 17:18 UTC — M
> Me too with youuu

---

### 17:18 UTC — Chef
😄 Let's forge some games!

---

### 17:37 UTC — Ian Branum
> I love you guys

---

### 17:42 UTC — M
> ajjajaja

---
