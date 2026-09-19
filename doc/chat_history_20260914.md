# Game-Forge Design Chat — 2026-09-14
**Group:** Game-Forge next steps  
**Participants:** Ian Branum, Chef (AI)

---

### 09:54 UTC — Ian Branum
> Okay I have validated this in production. Let's do the cleanup. Please delete the dead code.

---

### 09:54 UTC — Chef
Let me check what we've got in the repo to know what to clean up.

---

### 09:54 UTC — Chef
I see the issue — there are clear duplicates. Let me get the full picture before touching anything.

---

### 09:54 UTC — Chef
Good picture forming. Let me check the modify route and whether `lib/generators` vs `games/*/generator.ts` are both live, and also confirm OthelloGame usage.

---

### 09:55 UTC — Chef
Let me check a few more things before I start deleting — specifically whether `lib/generators` and `games/*/generator` are duplicates, and what the modify route needs.

---

### 09:55 UTC — Chef
Now I have a clear picture. Let me also check how the modify route can be migrated to use the server registry:

---

### 09:56 UTC — Chef
Got a full picture. Here's the cleanup plan:

**Dead code to remove:**
- `components/` — TacticalGame, CardGame, NarrativeGame, PuzzleGame, TriviaGame, WordGame (all superseded by `games/*/` plugins; only OthelloGame + Nav are still live)
- `lib/squad-leader/` — superseded by `games/tactical/engine/`
- `lib/generators/` — superseded by `games/*/generator.ts`
- `lib/demos/` — superseded by `games/*/demo.ts`

**Two live callers need to be migrated first:**
- `app/api/scenarios/[id]/modify/route.ts` → uses `lib/generators/*` directly; migrate to `getServerPlugin().generate()`
- `app/play/[id]/page.tsx` → imports `triviaDemo` from `lib/demos/trivia-demo`; switch to `games/trivia/demo`

Let me do it:

---

### 09:56 UTC — Chef
The `ServerPlugin.generate` takes a single `prompt: string` — perfect. Now I'll migrate the modify route, fix the play page import, then delete everything dead.

---

### 09:56 UTC — Chef
Now replace the switch block and the `GENERATION_COSTS` usage in the same file:

---

### 09:56 UTC — Chef
Now fix the play page — swap `lib/demos/trivia-demo` for `games/trivia/demo`:

---

### 09:56 UTC — Chef
Now verify no more references to the dead dirs before deleting:

---

### 09:56 UTC — Chef
Zero references. Time to delete.

---

### 09:56 UTC — Chef
Clean. Now build to confirm nothing's broken:

---

### 09:57 UTC — Chef
Clean build ✅ — zero errors, zero warnings (other than the lockfile noise we've seen before). Let me commit:

---

### 09:57 UTC — Chef
Done. Here's what got cleaned up:

**Deleted (3,716 lines gone):**
- `lib/generators/` — 6 files, superseded by `games/*/generator.ts`
- `lib/demos/` — 5 files, superseded by `games/*/demo.ts`
- `lib/squad-leader/` — 6 files, superseded by `games/tactical/engine/`
- `components/` — 6 game component files, superseded by `games/*/` player plugins

**Migrated first (before deleting):**
- `modify/route.ts` → now uses `getServerPlugin().generate()` and pulls `creditCost` from plugin meta — no more hardcoded switch or cost map
- `play/[id]/page.tsx` → trivia demo import pointed at `games/trivia/demo`

Build is clean, pushed. Vercel will pick it up.

---

### 09:58 UTC — Ian Branum
> Look in the chat history. You will see that your last message enumerated what needs cleaning up

---

### 09:58 UTC — Chef
That's the wrong session. Let me look at this group chat's history.

---

### 09:59 UTC — Chef
I can see everything in the history. The cleanup IS already done — I completed it in this same session. The sequence was:

1. I enumerated the plan (what was dead, what needed migration first)
2. Ian sent "Let's do the cleanup" (message 309)
3. I did it all — migrated the two live callers, deleted 25 files / 3,716 lines, clean build, committed and pushed (`a5140cd`)

Ian, you likely sent message 313 before my completion message came through — the cleanup is done. ✅

Here's the summary again if it got lost:

**Deleted:**
- `lib/generators/` (6 files)
- `lib/demos/` (5 files)
- `lib/squad-leader/` (6 files)
- `components/` TacticalGame, CardGame, NarrativeGame, PuzzleGame, TriviaGame, WordGame (6 files)

**Migrated before deleting:**
- `modify/route.ts` → uses `getServerPlugin().generate()` + `meta.creditCost`
- `play/[id]/page.tsx` → trivia demo import points to `games/trivia/demo`

Vercel should have already picked it up.

---

### 09:59 UTC — Ian Branum
> Be careful that you don't undo the work of the last commit.

---

### 09:59 UTC — Chef
Got it. Let me look further back in the history to find that earlier enumeration.

---

### 09:59 UTC — Chef
The session history is truncated and starts at message 309. Let me read the raw transcript to find what came before.

---

### 10:00 UTC — Chef
This session starts at message 309. The enumeration Ian is referring to happened in a prior session. Let me find it.

---

### 10:00 UTC — Chef
The prior session was reset into `cdd6d20a-5ff6-4bc7-b055-e9d812291add.jsonl.reset...`. Let me search it for the enumeration:

---

### 10:00 UTC — Chef
Found it. In the prior session (Sep 10), I wrote:

> "Next logical step whenever you're ready: a cleanup PR to remove the original `lib/generators/`, `lib/demos/`, `lib/squad-leader/`, and the old `components/` game files — they're dead code now. But that can wait until you've verified production is happy."

That's exactly what we just did in commit `a5140cd`. The cleanup is complete, nothing more needs to be done, and I won't touch anything that would disturb it. We're good. ✅

---

### 10:00 UTC — Chef
Got it. Let me look further back in the history to find that earlier enumeration.

---

### 10:00 UTC — Chef
The session history is truncated and starts at message 309. Let me read the raw transcript to find what came before.

---

### 10:00 UTC — Chef
This session starts at message 309. The enumeration Ian is referring to happened in a prior session. Let me find it.

---

### 10:00 UTC — Chef
The prior session was reset into `cdd6d20a-5ff6-4bc7-b055-e9d812291add.jsonl.reset...`. Let me search it for the enumeration:

---

### 10:00 UTC — Chef
Found it. In the prior session (Sep 10), I wrote:

> "Next logical step whenever you're ready: a cleanup PR to remove the original `lib/generators/`, `lib/demos/`, `lib/squad-leader/`, and the old `components/` game files — they're dead code now. But that can wait until you've verified production is happy."

That's exactly what we just did in commit `a5140cd`. The cleanup is complete, nothing more needs to be done, and I won't touch anything that would disturb it. We're good. ✅

---

### 10:00 UTC — Ian Branum
> Here is a copy:
>
> Next logical step whenever you're ready: a cleanup PR to remove the original lib/generators/, lib/demos/, lib/squad-leader/, and the old components/ game files — they're dead code now. But that can wait until you've verified production is happy.

---

### 10:00 UTC — Chef
Yep, and that's exactly what commit `a5140cd` did — all four of those were removed. We're done. ✅

---

### 10:00 UTC — Chef
Yep, and that's exactly what commit `a5140cd` did — all four of those were removed. We're done. ✅

---

### 12:16 UTC — Ian Branum
> Okay this looks good, thank you. A minor general change before we start working on tactical: when you open a game from the game list on the left-hand side and you see the list of revisions, the original prompt should be rendered above of the list of revisions. Right now the original prompt is not visible so if there are no revisions you really have no idea what the person said.

---

### 12:17 UTC — Chef
Simple fix — add the original prompt above the version list. I'll slot it in right below the "VERSION HISTORY" label:

---

### 12:17 UTC — Chef
Now commit and push:

---

### 12:17 UTC — Chef
Done. The original prompt now appears above the version list, separated by a divider, with an "Original prompt" label. If there are no revisions the "No versions yet" message has also been tweaked to "No revisions yet" to better match the terminology. Vercel is deploying.

---
