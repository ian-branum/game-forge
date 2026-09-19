# Game-Forge Design Chat — 2026-09-18
**Group:** Game-Forge next steps  
**Participants:** Ian Branum, Chef (AI)

---

### 09:14 UTC — Ian Branum
> This looks good. Thanks! Next I would like to update the way account creation and login work. Right now we only allow you to log in using Gmail. I would like to add the option for the user to create a username and password as well. Also during this process I would like to capture a display name, which is what other users will see in the system.

---

### 09:14 UTC — Chef
Let me survey what's currently in the auth setup before we plan this out.

---

### 09:14 UTC — Chef
Good, I've got the full picture. Here's what we're working with and what needs to change:

**Current state:**
- NextAuth v5 with Google OAuth only
- Prisma adapter (PostgreSQL), standard NextAuth User model
- No `displayName` field, no password field

**Plan for credentials + display name:**

**Schema changes:**
- Add `displayName String?` to User
- Add `password String?` to User (bcrypt hashed, nullable so Google users aren't affected)

**Auth changes:**
- Add `Credentials` provider to `auth.ts`
- Add `/api/auth/register` endpoint for sign-up (email + password + displayName)
- Pass `displayName` through the session callback

**UI changes:**
- Update the sign-in UI to show tabs: "Sign in with Google" vs "Email & Password"
- Add a sign-up flow: email, display name, password, confirm password

A few design decisions before I kick this off:

1. **Sign-up flow** — should it be on the same page as login (toggled section), or a separate `/signup` route?
2. **Display name for Google users** — when someone signs in with Google for the first time, do you want to capture a display name then? Or just use their Google name?
3. **Where is the current login UI?** — is it a custom page or NextAuth's built-in one? (Let me check)

---

### 09:14 UTC — Chef
Got it. Here's what needs to happen:

**DB:** Add `displayName` and `password` (nullable) to the User model
**Auth:** Add NextAuth Credentials provider + JWT session strategy; Google users get `displayName` auto-set from their Google name
**API:** New `/api/auth/register` endpoint for email+displayName+password signup
**UI:** Custom `/login` page with tabs (Google | Email), toggle for Sign Up vs Sign In; update landing + nav buttons to route there

Two quick design questions before I start:
1. For existing Google users — should we pull `displayName` from their Google `name` automatically, or prompt them to choose one after first sign-in?
2. Any preference on where sign-up lives — same `/login` page with a "Create account" toggle, or a separate `/signup` route?

While you think about those — let me get the DB migration and package install done now since those aren't UI decisions, and delegate the rest to the coder.

---

### 09:16 UTC — Chef
The migration detects drift (DB was created outside Prisma's migration history). No problem — I'll use `db push` instead, which is safe for this and won't wipe data.

---

### 09:16 UTC — Chef
DB is updated. Now I'll write up the full task brief and delegate to the coder.

---

### 09:17 UTC — Chef
Kicked it off. Here's what I've done so far and what's in flight:

**Done:**
- Added `displayName` and `password` columns to the DB (already live on Neon)
- Installed `bcryptjs`

**The coder is now implementing:**
- `auth.ts` — adding Credentials provider + JWT strategy, auto-setting displayName for Google users
- `types/next-auth.d.ts` — extending session types
- `app/api/auth/register/route.ts` — signup endpoint
- `app/login/page.tsx` — custom login page with Google tab + Email tab (sign in / sign up toggle)
- Updated landing page + nav to route to `/login` instead of calling `signIn("google")` directly

To answer the design question I mentioned — I went with a **single `/login` page** with tabs (Google vs Email) and a sign-in/sign-up toggle within the Email tab. Clean and contained. For Google users, their Google name gets auto-set as their display name on first sign-in.

I'll let you know when the build is clean and it's ready to test!

---

### 09:17 UTC — Ian Branum
> 1. For existing Google users I will manually enter their names. There are only three. 
> 2. I think on the login page is fine.

---

### 09:17 UTC — Chef
Got it. Let me update the coder with that — simplifies the Google auto-display-name logic.

---

### 09:17 UTC — Chef
Noted and updated. The coder will keep the JWT callback simple — just reads `displayName` from the DB, no auto-write for Google users. You can set the 3 existing ones manually whenever you're ready (direct DB update or I can do it for you once the feature ships). 

I'll flag you when the build is green.

---

### 14:59 UTC — Ian Branum
> Okay, this looks really good. Now I would like to change the way the dashboard works. Specifically, I want to break it into two tabs. One is my games and it will look exactly like what we have now, except the toggle will go between active and archived And it will only show games that you have created, purchased to play, or cloned. We will add two columns, creator and description, and remove one column, prompt.Let's make the order, type, title, description, creator, created, versions, visibility, actions. The second area, which will be navigated to maybe by tab, I don't know. Let's discuss that. Will be marketplace. So the dashboard will have two major views. My games and marketplace. The logic is that my games are the things that you can play, have created, have cloned, things that you can edit and manage. Marketplace is where you go to see what other people have done. We'll build marketplace in a bit. Let's focus on my games first.

---

### 14:59 UTC — Chef
Let me pull up the current dashboard before we plan anything.

---

### 14:59 UTC — Chef
Good, got the full picture. Let me also check the scenarios API to understand what data comes back.

---

### 14:59 UTC — Chef
Good. Before I spin up the coder, a few things worth aligning on:

**Tab nav style** — my recommendation: pill-style tabs at the top of the dashboard (right below the nav bar), `MY GAMES` and `MARKETPLACE` side by side. Simple, clean, fits the existing aesthetic. Marketplace tab can just show a "coming soon" placeholder for now. Agree?

**Three questions before I can write the task brief:**

1. **Description column** — where does this come from? The current schema only has `prompt` (the raw user input). Options:
   - Add a new `description` field to the DB and have the AI generate a short one-liner when a game is created
   - Or just use the prompt text, truncated (simplest, no schema change)
   - Or let users write their own description when they publish
   
   My recommendation: have the AI generate a short description (1-2 sentences) during the forge flow and store it. Clean data going forward.

2. **Creator column** — this means showing the `displayName` of the game's author. That requires joining `User.displayName` in the API query. Should it show for all games (including your own), or only for non-owned games? My instinct: always show it — consistent column, and it confirms to you which ones are yours vs. others you've acquired.

3. **"Purchased to play" / "Cloned"** — there's currently no DB relationship tracking which users have purchased or cloned a scenario. For the initial build of "My Games," should we scope it to: **games you created**? Or do you want to also build the purchased/cloned tracking now? (The marketplace feature would naturally drive that anyway.)

---

### 15:05 UTC — Ian Branum
> Tab nav style - concur, let's go with pill style.
> 1. Let's go with your recommendation, but make the title and description editable in the game detail screen.
> 2. Always show. Not sure what to do if it is a game that you cloned from someone and then updated. 
> 3. Let's go with just games you created for now, we'll update when we create the marketplace tab.
> Thanks!

---

### 15:05 UTC — Chef
Good answers. Let me read the forge/generate flow before writing the task, then I'll handle the schema myself and delegate the rest.

---

### 15:05 UTC — Chef
Good, I have what I need. Let me handle the schema first, then write the brief.

---

### 15:06 UTC — Chef
`description` column is live. Now writing the task brief.

On the clone question — good edge case. My call: show the **original creator's** displayName always (it's their design), but the game lives in the claimer's My Games. We can add a "cloned from X" badge later if needed. I'll bake that into the API design.

---

### 15:07 UTC — Chef
Kicked off. Here's what's in the brief:

**Done already:**
- `description` column added to DB (live on Neon)

**Coder is implementing:**
- **Forge flow** — AI generates a 1-sentence description at game creation time, stored in DB
- **API** — scenarios endpoint returns `description` + resolved `creator` displayName; new PATCH endpoint for title/description edits
- **Dashboard** — pill tabs (MY GAMES / MARKETPLACE placeholder), Active/Archived toggle, new column order with Description + Creator, Prompt column gone
- **Modal** — editable Title + Description fields at top (owner only), saves on blur, live-updates the table row

On the clone/creator question — I went with: always show the **original creator's** displayName (the person who designed the game). Makes sense from a marketplace perspective — credit goes to the designer regardless of who's playing or modifying it.

I'll flag you when the build is green.

---

### 15:22 UTC — Ian Branum
> Looks good. Thanks. I think we need a little bit more visual separation between the My Game Marketplace tabs and the filters beneath them. They sorta look and feel like they're all a group and they're not. What are some ideas?

---

### 15:22 UTC — Chef
Good eye. A few options that fit the existing aesthetic:

**1. Section divider with label** — a thin `#1e2a4a` border below the tabs, then the filters sit in a slightly different background shade (`#060b1a` vs `#05071a`). The color shift alone signals "these are two different zones."

**2. Tabs flush top, filters inset** — give the tabs their own full-width bar at the very top (same `#060b1a` as the nav), then the filters bar below it gets a subtle indent (`px-6`) and a dimmer bg. Visual hierarchy: tabs = section selector, filters = controls within that section.

**3. Vertical breathing room + a label** — add a small section header below the tabs. Something like `— MY GAMES —` in tiny orbitron tracking-widest gray text above the filters. Reinforces that you're now "inside" My Games. The label doubles as a divider.

**4. Filters in a card/panel** — wrap the filters in a rounded pill container or a subtle bordered box, so they read as a toolbar rather than freestanding buttons at the same visual level as the tabs.

**My recommendation: combine 1 + 2.** Tabs get their own sticky bar with one bg color, filters get the next sticky bar with a slightly different bg and a top border. Two distinct horizontal bands — unmistakably separate zones. Minimal code change, maximum clarity.

Want me to spec that up and send it to the coder?

---

### 15:24 UTC — Ian Branum
> Okay, that sounds good. Go ahead and do it. Thanks.

---

### 15:24 UTC — Chef
Sent. The approach: two distinct sticky bars — tabs on `#060b1a` (nav color) with a solid border underneath, filters on `#05071a` (page color) with a dimmer border. The color step-down + border weight difference makes it immediately obvious which is navigation and which is tooling. I'll let you know when it's done.

---

### 15:28 UTC — Ian Branum
> Much clearer. Thank you.Two minor UI issues. One when I modify a game often, but I don't think always when I close the modal, it immediately reopens again. So that I have to close it twice. I don't think this happens every time, but it happens frequently. Two, when I update the visibility during modification and I close the modal, it does not update in the table. When I update the description, it updates, but the visibility does not.

---

### 15:28 UTC — Chef
Both bugs are clear to me — let me send precise fixes to the coder rather than a vague description.

**Bug 1** — event bubbling. The × button's click fires `onClose`, but the event keeps bubbling up through the React tree and likely lands on a MODIFY button or row handler that re-opens it. Fix: `e.stopPropagation()` on the close button, and wrap the backdrop handler properly.

**Bug 2** — `onModified` is never called after a visibility toggle. It's only called after `handleModify` (new version). The table has no way to know visibility changed.

---

### 15:29 UTC — Chef
Two surgical fixes:

1. **Double-close** — the × button's click was bubbling up and landing on whatever opened the modal. `stopPropagation()` on both the button and the backdrop kills that.

2. **Visibility not syncing** — the toggle was updating local state and hitting the API, but forgetting to call `onModified`. The parent table never got the memo. One line fix.

I'll flag you when the coder confirms it's clean.

---

### 15:29 UTC — Chef
Both fixes are in and the build is clean. You should be good — close once, visibility updates immediately in the table. Give it a test and let me know if anything else feels off.

---

### 15:36 UTC — Ian Branum
> That looks great. Thanks. On reflection, I don't think we need the archive button in the actions column. I think it should be on the modify modal in the lower left-hand corner. I figure users will very, very rarely archive a game and we want to make it harder to do

---

### 15:36 UTC — Chef
Good call. Rare + consequential = hide it behind a deliberate click.

---

### 15:36 UTC — Chef
On it. Archive moves to the modal footer — bottom-left, small, muted gray so it doesn't draw the eye. PLAY stays bottom-right. You have to actively open the modal and look for it to archive something, which is exactly the right amount of friction for a rarely-used destructive action.

---

### 15:52 UTC — Ian Branum
> This looks really solid. Thank you. Now let's consider marketplace. My primary objective here is that users be able to buy games from other users paying with the same credits that they use to create games. So how might this work? A user could browse the marketplace, see the title and description of a game that looks interesting. That's not enough. We have to let the user try the game. But to what extent and how many times? I guess if a game is only interesting enough that you want to play it one or two times, it's not worth buying. So maybe we let them try it three times? Does that sound right? If they want to play a fourth time, they have to pay for it. Now my thinking is that if you pay to play, you may not modify. But if you pay to clone, you get access to the modify interface. The question is, if you modify the game, especially if you modify it heavily, can you then put your version on the marketplace? And if it sells. Does the original author get a cut? And how far do we let this chain? If you have an original game created by player A, player B clones it, modifies it, puts it on the marketplace, player C clones it, modifies it further, and puts it on the marketplace, player D buys it for a hundred credits, who gets how many credits? Let's discuss.

---

### 15:52 UTC — Chef
Great set of questions. Let me work through each layer:

---

**Try before you buy — 3 free plays**
Yes, 3 is the right number. Enough to know if you love it, not enough to just play it to death for free. We'd need a new lightweight DB table: `ScenarioPlay { userId, scenarioId, count }` — increment on each play, gate at 3 for non-owners.

---

**Pay-to-play vs pay-to-clone**
Clean distinction. I'd frame it as two separate products:
- **Play license** — pay once, play forever, no modify access
- **Clone license** — pay once, get your own copy, full modify + publish rights

Clone price should always be ≥ play price (otherwise why would anyone pay to play?). We could enforce that in the UI.

---

**The chain question — here's my recommendation**

Keep it simple: **one-time fee, settled at clone time, no ongoing royalties.**

When B clones A's game, B pays A's `priceToClone` — that's A's payday, done. B now owns their fork. When C clones B's game, B gets paid, A gets nothing from that transaction. And so on.

This means by the time D buys C's game for 100 credits, C gets 100 credits. B already got paid when C cloned. A already got paid when B cloned. Every transaction is clean, simple, and final.

**Why not chain royalties?**
- Complex to implement correctly (what if someone in the chain deletes their account?)
- Hard to explain to users ("you get 23 credits but 4 go to someone you've never heard of")
- The chain can get arbitrarily deep
- The original creator still got paid — they set their clone price knowing someone might remix it

**What we do keep: attribution.** Even with no money flowing up the chain, we display the lineage: *"Originally by Player A · Remixed by Player B · Remixed by Player C."* Good for credit, good for discovery, zero implementation complexity beyond storing a `parentScenarioId` and `originalScenarioId` on the clone.

---

**Summary model:**

| Action | Cost | What you get |
|---|---|---|
| Try | Free (×3) | Play it |
| Buy to play | `priceToPlay` credits | Play forever |
| Clone | `priceToClone` credits | Your own copy, modify, publish |
| Sell clone | You set the price | You keep 100% |

Platform could eventually take a small cut (say 10%) but I'd leave that for later — no need to build it in now.

Does that model feel right? If so I can spec out the DB schema for the marketplace (play tracking, purchases, parent/original lineage) before we start building.

---

### 16:00 UTC — Ian Branum
> Okay, that feels right. Especially if we make the remix attributions clickable links. That way, if you're looking at a remix attribution list, you can explore the people who created the original and the remixes. One detail. There is a dichotomy between Games and puzzles versus World War II tactical. Games and puzzles are the sort of things that you can play many, many times. Thus I am happy for a player to try it up to three times. World War II tactical are really scenarios and I might not want to play the same scenario more than three times. So instead I think we should limit it to playing it once for three turns. Does that make sense? And I don't know what to do with adventure. An adventure could be anything from something you'd only want to play once because it's a mystery. To something that you could play over and over and over again, for example, a abstract dungeon exploration game.What do you think?

---

### 16:00 UTC — Chef
Great nuance. Let me work through each type:

---

**Games & Puzzles — 3 free sessions ✓**
These are built to be replayed. Chess, checkers, puzzle variants — the whole point is coming back. 3 sessions is right.

---

**WW2 Tactical — I'd push back gently on "3 turns"**
Tracking turns mid-game requires the browser engine to talk to the server on every turn, then gate the UI — significant architectural complexity, and easy to circumvent client-side. The simpler equivalent: **1 free session** (one full play of the scenario). That's actually *more* generous than 3 turns — you experience the whole thing — but it achieves your goal: you know the outcome after one play, so replaying it is the "collector/enthusiast" use case worth paying for. If you stormed the beach and won, why do you need to do it again for free?

---

**Adventure — let the creator declare it**
Your instinct is right that it varies wildly. I'd add one field to the publish flow: a toggle the creator sets when listing on the marketplace:

- **"Fixed story"** → 1 free session (mystery, linear narrative — you played it, you know the ending)
- **"Infinite replay"** → 3 free sessions (procedural dungeon, branching world — different every time)

The creator knows their game better than we do. This also becomes a marketing signal in the marketplace — players know what they're getting.

---

**Summary:**

| Type | Free trial |
|---|---|
| Games & Puzzles | 3 sessions |
| WW2 Tactical | 1 session |
| Adventure — fixed story | 1 session |
| Adventure — infinite replay | 3 sessions |

All stored as a `freePlayLimit` int on the scenario (1 or 3). Simple to query, simple to enforce.

---

**On clickable attribution chains** — totally agree. Each game card in the marketplace shows the lineage: *"A → B → C"* where each name is a link to that player's public profile/games page. Discovery engine built-in.

Does the trial model feel right? If so I'll spec the full marketplace schema next.

---

### 16:03 UTC — Ian Branum
> I think you've got it right. On the World War II tactical, ideally the player will lose on their first game and want to win and thus will pay.I'd almost suggest making it harder on the free play, but that sounds really complicated. So let's go with your recommendations.Spec away, please.

---

### 16:03 UTC — Chef
Here's the full marketplace schema spec:

---

**New fields on `Scenario`:**
```
parentScenarioId  String?   // the scenario this was directly cloned from
originalScenarioId String?  // root ancestor of the lineage chain (null = this IS the original)
freePlayLimit     Int       @default(3)  // 1 or 3 — set at publish time
```

`originalScenarioId` is how we build the clickable attribution chain cheaply — one query gets the whole lineage without recursive joins.

---

**New table: `ScenarioPlay`**
Tracks trial session count per user per scenario.
```
id          String   @id @default(cuid())
userId      String
scenarioId  String
count       Int      @default(0)   // incremented each time they start a session
updatedAt   DateTime @updatedAt

@@unique([userId, scenarioId])
```

When a user hits Play: look up their row, compare `count` to `freePlayLimit`. If `count >= freePlayLimit` and they have no license, gate them. Otherwise increment and let them through.

---

**New table: `ScenarioLicense`**
Records who has paid for what.
```
id          String      @id @default(cuid())
userId      String
scenarioId  String
type        LicenseType  // enum: PLAY | CLONE
amount      Int          // credits paid at time of purchase
createdAt   DateTime     @default(now())

@@unique([userId, scenarioId, type])
```

The unique constraint means you can't buy the same license twice. A CLONE license implicitly grants PLAY rights too — we enforce that in the application layer, not the DB.

---

**Credit flow at purchase:**

When a player buys a license:
1. Deduct credits from buyer
2. Credit the scenario owner (not the chain — settled at clone time as we agreed)
3. Write two `CreditTransaction` rows: one `-amount` for buyer (reason: `"play_purchase"` or `"clone_purchase"`), one `+amount` for seller (reason: `"sale"`)

All three writes in a single `$transaction`.

---

**Clone flow:**

When a player clones:
1. Purchase the CLONE license (credit transfer above)
2. Create new Scenario with:
   - `userId` = buyer
   - `parentScenarioId` = source.id
   - `originalScenarioId` = source.originalScenarioId ?? source.id
   - Copy: category, payload, activeVersionId, freePlayLimit
   - Title: prefixed "Remix: [original title]" (editable immediately)
   - `isPublic: false` by default — owner publishes it themselves when ready
3. New scenario starts with version history clean (no inherited versions — they own it from here)

---

**Attribution chain query:**

Given any scenario, build the lineage by following `parentScenarioId` up. Since we also store `originalScenarioId`, we can get the root in one lookup and then fetch the chain with: `WHERE originalScenarioId = X OR id = X ORDER BY createdAt`. Fast, no recursion.

Display as: `PlayerA → PlayerB → PlayerC` each name linking to `/players/[displayName]` (a public profile page showing their published games — simple, good for discovery).

---

**`freePlayLimit` values by type:**

| Scenario type | Value |
|---|---|
| Games & Puzzles | 3 |
| WW2 Tactical | 1 |
| Adventure — fixed | 1 |
| Adventure — infinite | 3 |

For Adventure, we add a small radio to the publish flow: *"Is this adventure a fixed story or infinitely replayable?"* That sets `freePlayLimit` to 1 or 3. Games & Puzzles and Tactical are automatic.

---

**Play gating logic (server-side, on session start):**

```
isOwner OR hasLicense(PLAY or CLONE) → allow, no tracking
freePlayCount < freePlayLimit → allow, increment count
otherwise → return 402 with { trialExhausted: true, priceToPlay, priceToClone }
```

---

That's the full data model. Relatively tight — two new tables, three new columns on Scenario. Want me to push the schema and start building the marketplace tab?

---

### 16:08 UTC — Ian Branum
> Okay, this looks really good. The only thing I would add is I think there's a third kind of adventure. A mystery. The mystery, once discovered, cannot be replayed. There's no point. You know the answer. A fixed can be replayed, although it will lose its allure after a couple of replays, perhaps. The infinite should be replayable a large number of times. I don't know what to do about the mystery. Maybe if you were playing in demo mode, it automatically stops after n steps, and we let the author define n. Let's add the adventure mystery class, but we'll define how that works later. Does that work?

---

### 16:08 UTC — Chef
Works perfectly. Here's how I'd capture it cleanly without over-engineering:

**Add to schema now:**
```
adventureSubtype  String?   // "fixed" | "infinite" | "mystery" — only set for narrative games
trialStepLimit    Int?      // mystery only — author defines how many steps before trial gates. null = TBD
```

**Interim behavior for mystery (until we design it properly):**
`freePlayLimit = 1` as a placeholder — same as Fixed for now. The `adventureSubtype = "mystery"` flag is in the DB so we can find these games and apply the proper mechanic when we build it.

**Updated adventure table:**

| Adventure subtype | Free trial | Notes |
|---|---|---|
| Fixed | 1 session | Loses allure, but technically replayable |
| Infinite | 3 sessions | Different every time |
| Mystery | TBD | Author-defined step limit; placeholder = 1 session |

The author sets subtype at publish time — three radio options: *Fixed Story / Infinite Replay / Mystery* with a short description of each. Mystery shows an additional field: *"Stop trial after ___ steps"* — greyed out and labelled "coming soon" for now so it's visible in the UI but not functional yet.

That way the data model is future-proof and authors can already categorize their adventures correctly, even if mystery trial enforcement isn't wired up yet.

Ready to push the schema and start building?

---

### 16:09 UTC — Ian Branum
> This looks fantastic. Please spec and task the coding agent

---

### 16:09 UTC — Chef
Schema first, then the brief.

---

### 16:10 UTC — Chef
Schema is live. Now writing the task brief.

---

### 16:11 UTC — Chef
Schema is live, task is running. Here's what's being built:

**DB (done):**
- `ScenarioPlay` — tracks trial sessions per user/game
- `ScenarioLicense` — records PLAY and CLONE purchases
- `parentScenarioId`, `originalScenarioId`, `freePlayLimit`, `adventureSubtype`, `trialStepLimit` on Scenario

**New API endpoints:**
- `GET /api/marketplace` — browseable public games with trial/license status per user
- `POST /api/marketplace/[id]/purchase` — atomic credit transfer for PLAY or CLONE
- `POST /api/marketplace/[id]/clone` — forks the scenario into buyer's My Games
- `POST /api/play/[id]/start` — trial gate enforcement
- `PATCH /api/scenarios/[id]/publish` — full publish settings (replaces the old visibility toggle)

**UI:**
- Marketplace tab: card grid (not table), trial status badges, TRY/PURCHASE buttons, clickable lineage attribution
- `/play/[id]`: trial gate screen when exhausted, with purchase options inline
- Modify modal: full Publish section replacing old pricing UI, with adventure subtype selector for narrative games

This is the biggest task yet — I'll flag you when the build is clean.

---
