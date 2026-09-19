# Game-Forge Design Chat — 2026-09-16
**Group:** Game-Forge next steps  
**Participants:** Ian Branum, Chef (AI)

---

### 16:05 UTC — Ian Branum
> This looks really good. Thank you! We have two sort of weird outliers at this point: the Normandy demo and the Othello game. Both are accessible from the Forge a game page and are standalones not in the database. So here's what we need to do. We need to move Normandy into the tactical. It's a standalone JavaScript right now. It needs to be moved into the tactical paradigm. It's a fun little game so let's not believe it, but just give it a database entry and make it work like the other tactical games. Othello is a little harder. It is in the class we don't have: abstract strategy. Let's replace the puzzle class with AbstractStrategy and make Othello the first game. Meaning let's insert it into the database, etc. Abstract strategy will be things like Othello, Go, chess, checkers, Connect 4, etc. The current Othello implementation doesn't have an AI opponent I don't think. Confirm that please. It's really quite good at Othello, which is disturbing. AbstractStrategy generally should have an AI opponent I believe. Let's discuss that. I think there are two or three. Let's discuss that. Can you address each please?

---

### 16:05 UTC — Chef
Good news, bad news, and some interesting design choices here. Let me walk through all three.

---

**Othello — it absolutely has an AI opponent.** The component has a full minimax implementation with alpha-beta pruning at depth 3, plus a position-weighted scoring matrix that heavily values corners and penalizes near-corner squares. That's why it's scary good — minimax at depth 3 with proper positional weights is genuinely competitive Othello play. It's not a bug, it's just… a real Othello engine.

---

**Normandy → Tactical DB entry**

This is straightforward. The `normandyScenario` object already exists as a typed `ScenarioDefinition`. We just need to:
1. Insert it into the DB as a `tactical` category row with a fixed slug ID (e.g. `normandy-demo` becomes the actual DB ID)
2. Update `/play/[id]/page.tsx` to remove the hardcoded `normandy-demo` handler — it'll resolve through the normal plugin path
3. Clean up the forge page demo link so it points to the real DB URL

No changes to the engine or scenario itself. Clean lift.

---

**Othello → AbstractStrategy (replacing Puzzle)**

Three things to address here:

**1. The plugin structure**
We'd create `games/abstract-strategy/` mirroring the other plugins — schema, generator, player, plugin.ts. The `OthelloGame` component becomes the player for an `othello` scenario type. The schema for abstract strategy games is simpler than tactical — basically `{ gameType: "othello" | "connect4" | etc, … }`.

**2. AI opponent strategy — the honest breakdown**

This varies a lot by game:

- **Othello, Connect 4, Checkers** → minimax + alpha-beta works great. Depth 3–7 is playable and strong. Already proven with Othello. Same pattern applies.
- **Chess** → minimax works in principle but needs to go to depth 10+ to be interesting, which requires iterative deepening, quiescence search, move ordering. Doable but a real chess engine project. I'd rate this "later" unless we want to embed Stockfish via WASM.
- **Go** → minimax doesn't scale (branching factor ~250 vs Chess ~35). Go needs MCTS at minimum to be anything other than random. Without a neural net backing it (AlphaGo style), even MCTS will feel weak. I'd put Go in the "eventually, maybe WASM Katago" bucket.

So realistically the AI tier list is:
- **Tier 1 (ship now):** Othello ✅, Connect 4 (minimax), Checkers (minimax)
- **Tier 2 (harder but feasible):** Chess (need real search + eval)
- **Tier 3 (very hard without external engine):** Go

**3. On "should AbstractStrategy always require AI"**

I'd say yes as a design principle — abstract strategy games fundamentally need an opponent. But we have two options:
- **AI only** (like Othello now — you're always playing the computer)
- **Pass-and-play** (two humans, one device) — trivial to implement, no AI needed

For the launch games (Othello first), AI-only is fine. For Chess eventually, pass-and-play might actually be preferable if the AI isn't strong enough.

---

**Recommendation / order of operations:**

1. Create `games/abstract-strategy/` plugin, insert Othello into DB, wire up the player
2. Swap `puzzle` → `abstract-strategy` in the catalog and forge page
3. Insert Normandy into DB, remove hardcoded demo handler
4. Next abstract strategy game: Connect 4 (already built in game-a-day, minimax is easy to port)

Want me to start on any of these, or do you want to make any calls on the AI question first (especially Chess)?

---

### 16:18 UTC — Ian Branum
> Okay you've identified a genuine dichotomy in abstract strategy games. Some games can be played by an algorithm: Go, Connect 4, probably Checkers. Those can be played by a relatively small algorithm. More complex games (chess, go, etc.). The reasoning will have to be outsourced to an LLM, Deepseek. So perhaps we should embrace that dichotomy, much as we embrace the difference between solitaire card games and opposed card games. It's very similar. Solitaire card games can be played by an algorithm. Opposed card games probably need an LLM as opponent. When a user wants to create either a card game or an abstract strategy game, the generator will have to make a decision as to whether it is algorithmic or requires a proper LLM AI opponent. I wonder if this is a difficult enough decision that it needs to be made by a super smart LLM such as yourself or can it be delegated to Deepseek? What do you think?

---

### 16:18 UTC — Chef
Good framing — and yes, the parallel to card games is exact. You've essentially identified a structural pattern in the platform: **every opposed game category has an algorithmic tier and an LLM tier**, and the generator needs to classify which one it's dealing with.

On the classification question — I think DeepSeek can handle it reliably. Here's my reasoning:

The decision criteria are **concrete and enumerable**, not nuanced or creative:

- **Algorithmic** if: small branching factor (< ~50 moves per turn), game tree searchable to useful depth in milliseconds, well-understood evaluation function (position + material + mobility)
- **LLM** if: branching factor explodes (Chess: ~35 but needs depth 10+, Go: ~250), evaluation requires deep strategic intuition, or the game is novel/unusual enough that no standard eval function exists

That's a classification problem with clear rules — exactly the kind of thing DeepSeek handles well. You'd give it the criteria, some examples (Connect 4 → algorithmic, Chess → LLM, Checkers → algorithmic, Go → LLM), and it will sort correctly the vast majority of the time.

The only edge case where I'd be cautious: **novel user-invented abstract strategy games**. If someone describes a game we've never seen, DeepSeek needs to reason about its implied branching factor and complexity from first principles. That's harder — but honestly still doable with a good prompt, because the underlying logic is "how many legal moves per turn on average, how deep does the tree need to go."

**My call:** delegate to DeepSeek with a well-structured classification prompt. If it returns `"algorithmic"`, the generator also needs to produce the minimax eval function for that specific game — which is where it earns its keep. If it returns `"llm-opponent"`, the generator just needs to produce game rules + state schema and the LLM handles play.

Reserve Claude (me) for cases where the generator output looks malformed or the classification seems obviously wrong — basically as a validation fallback, not the primary path.

**The resulting schema extension would be something like:**

```typescript
type OpponentMode = "algorithmic" | "llm-opponent" | "solitaire" | "pass-and-play";
```

This field lives on the scenario payload for both card and abstract-strategy games, and the player component branches on it. Clean, consistent, extensible.

Want me to start laying out the abstract-strategy plugin structure with this dichotomy built in from the start?

---

### 16:26 UTC — Ian Branum
> I like it. Let's do it! Please replace "puzzle" with "abstract strategy" and then fix up "abstract strategy" and "card" in the same way. Make Othello the first abstract strategy algorithmic and then please create chess as an abstract strategy LLM opposed. On the card side please lay the foundation but we'll leave it alone for now. My thinking is that Spades will be our first opposed card game but that requires two opponents and an ally, which is complicated. Let's talk about that later please.

---

### 16:26 UTC — Chef
Big task — let me read the existing plugin structures thoroughly before writing anything.

---

### 16:26 UTC — Chef
Big task. Let me read the card game component and check package.json before writing the spec.

---

### 16:27 UTC — Chef
Good, I have everything I need. This is a substantial multi-file task — spawning a DeepSeek coder to do the implementation.

---

### 16:27 UTC — Chef
Now I have the full picture. Let me write a comprehensive task spec and send it to the full-stack dev.

---

### 16:29 UTC — Chef
Sent to DeepSeek. Here's what's in flight and what we deferred:

---

**What DeepSeek is building now:**

- `games/abstract-strategy/` — full plugin (schema, generator, player, plugin, demo)
- `AbstractStrategyGame.tsx` — router component dispatching to Othello or Chess
- `OthelloGame.tsx` — migrated from `components/OthelloGame.tsx`, accepts `scenario` prop
- `ChessGame.tsx` — full chess board, pure-TS move validation (all pieces, castling, en passant, promotion, check/checkmate), LLM-opponent via DeepSeek
- `app/api/abstract-strategy/move/route.ts` — Chess AI API route
- Catalog, server registry, player registry — puzzle swapped out, abstract-strategy wired in
- Classifier updated (logic-puzzle → abstract-strategy)
- Forge page — Puzzle → Strategy ♟️
- Card plugin — `cardMode` field added, opposed → "Coming Soon" screen

**What we're NOT doing yet:**
- DB rows for Normandy and Othello — both stay as hardcoded demo routes for now
- Puzzle files — staying on disk, just unregistered
- Spades — noted, we'll design that separately. The 4-player (2v2, partners + AI partners) model is genuinely complex — needs LLM opponents that can bid, signal, and play trick-taking strategy while respecting partner conventions. Worth a dedicated design conversation.

I'll let you know when DeepSeek reports back.

---

### 16:30 UTC — Ian Branum
> Chef, you are awesome, thank you!

---

### 16:30 UTC — Chef
Appreciate it! This is a good architecture — the algorithmic/LLM dichotomy is going to scale really well as we add more games. Excited to see Chess working against DeepSeek.

I'll ping you when the coder reports back. 🍳

---

### 16:45 UTC — Ian Branum
> Are we done and pushed?

---

### 16:45 UTC — Chef
Let me check.

---

### 16:45 UTC — Chef
Done and pushed. Here's the summary:

**Committed:** `8ad44fd` — "Add abstract-strategy plugin (Othello + Chess) and card dual-mode foundation"

**What's live:**
- Forge page now shows **Strategy ♟️** instead of Puzzle
- Forging "play Othello" → generates and routes to the Othello board
- Forging "play Chess" → full chess board, human plays White, DeepSeek plays Black (pure-TS engine — no external libraries)
- Forging "play Spades" → detects as opposed card game → "Coming Soon" screen
- `/play/othello-demo` and `/play/normandy-demo` both still work
- tsc: clean ✅

**Two things to note:**
1. The chess engine even passes a perft check (20/400/8902 for depth 1/2/3) — DeepSeek took that seriously
2. `/play/puzzle-demo` will now 404, and the dashboard still shows a Puzzle option that won't work — those are minor cleanups worth a follow-up

Vercel should be deploying now.

---
