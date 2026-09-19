# Game-Forge Design Chat — 2026-09-15
**Group:** Game-Forge next steps  
**Participants:** Ian Branum, Chef (AI)

---

### 16:46 UTC — Ian Branum
> Hey chef, are you ready to make some more changes to game-forge? Can you see the chat history and the repo? And also how are you set for context window right now?

---

### 16:46 UTC — Chef
[[reply_to_current]] Ready to go, Ian! ✅

**Repo:** `/home/agentuser/game-forge` — clean on main, 7 commits ahead of origin (need a push at some point). Last commit: showing original prompt above version history in dashboard.

**Context window:** 15k/1M tokens — basically empty, I've got tons of headroom.

**Chat history:** I can see this conversation. I don't have the full prior Game-Forge chat history loaded, so if there's relevant recent context (decisions made, next steps discussed), hit me with a quick recap or point me at the right files and I'll be up to speed fast.

What are we building?

---

### 16:49 UTC — Ian Branum
> Awesome! What are in the seven commits that you have that origin does not? Didn't you just push to origin?

---

### 16:49 UTC — Chef
Those are all the pluggable architecture work from our last session — 7 commits that never got pushed. The full stack:

1. `dd1e6a8` — scaffold pluggable arch (trivia plugin + registries + classifier)
2. `2626568` — migrate word, puzzle, card plugins
3. `aa2406f` — migrate narrative plugin
4. `f3f9774` — migrate tactical plugin + squad-leader engine
5. `346c2ce` — pluggable game-type architecture (core)
6. `a5140cd` — delete dead code (old generators, demos, components)
7. `981314a` — show original prompt above version history in dashboard

Looks like we never did the final push last session. Want me to push these up now before we start anything new?

---

### 16:50 UTC — Ian Branum
> I see those in GitHub

---

### 16:50 UTC — Chef
All synced — just needed a fetch. We're up to date with origin. What's next?

---

### 16:50 UTC — Ian Branum
> I would like to make the following updates to the tactical game:
>
> 1. Update the UI to call it "Squad Leader". No need to change its name in the code, db, etc. tactical is fine there. 
>
> 2. I want to change the order of play to shoot, move, rally. I think this will work better and more accurately reflects combat.With the current system, units are able to move up to hostile units and then shoot at them before the hostile units have a chance to fire.I think a shoot-to-suppress and then advance is more accurate.It punishes the first person to move into range, and that's fair.
>
> 3. When a user hovers over a hex, a tooltip pops up and shows the terrain, its effect, and what kind of unit is in the hex. It only shows the first unit in the hex, not the second.I want to change this so that, instead of showing the unit title like Rifle Squad, I would like it to show a physical representation of the counter that the Rifle Squad represents.If there are more than one unit in the hex, render in tiles, stacked vertically. For each unit, there should be a box. Inside that box, there should be a representation of the playing piece, the counter. Put the symbol in the middle and then organize the numbers around it in a sensible fashion. Maybe: 
> - Attack in the upper-left-hand corner
> - Range: center-left, indented slightly, in a smaller number
> - Move in the lower-left-hand corner
> - Defense in the upper-right-hand corner
> - Morale in the lower-right-hand corner
> Or something like that. Make it sensible. How will the user know what the different numbers are? Eventually, you'll know, but is there a better way to do this than representing a physical counter? Let's discuss.
>
> 4. Please put a rules link somewhere sensible. If the user clicks on it, pop up a modal with the rules of the game. Please organize these rules the way board games are usually organized:
> Section 1.0 Overview
> Section 2.0 Sequence of Play
> Section 3.0 Movement
> Section 4.0: Combat 
> etc. Something like that.
>
> Please come up with a plan for the above, ask any questions, and let's discuss before executing.

---

### 16:50 UTC — Chef
Great set of changes. Let me look at the current code before planning.

---

### 16:50 UTC — Chef
Good, I've got the full picture. Here's my plan and thoughts on each item:

---

**1. Rename to "Squad Leader" in UI**
Simple — update the header, briefing screen header, and any other display strings. No DB/code changes. Quick win.

---

**2. Shoot → Move → Rally order of play**
This is the right call tactically. Currently it's Move → Combat → Rally. Flipping to Combat → Movement → Rally means:
- Units declare fire first (suppressive fire)
- Then movement happens into a suppressed/degraded enemy
- Then rally at end

Changes needed:
- `types.ts`: reorder `Phase` type (cosmetic but good for clarity)
- `engine.ts`: `initGame` starts on `"combat"` phase, `advancePhase` cycles `combat → movement → rally`
- `TacticalGame.tsx`: phase label display, the `useEffect` that sets reachable/attackable tiles based on phase needs to fire on `combat` first
- Axis AI: currently runs all three phases in sequence — same logic, just reordered
- One wrinkle: the initial state currently starts on `movement`. With the new order, turn 1 opens with combat — but there are no targets in range yet (units start far apart in Normandy). That's fine and realistic: you scan for targets, find none, end combat phase, then advance.

---

**3. Counter tooltip with unit stats**
This is the most involved UI change. A few thoughts:

**Your proposed layout:**
```
┌─────────────────┐
│ ATK    [symbol]  DEF │
│  RNG            MRL  │
│ MOV                  │
└─────────────────┘
```
That's close to how real Squad Leader counters work. My suggested layout:

```
┌──────────────┐
│  4        3  │  ← Attack (top-left), Defense (top-right)
│    [NATO]    │  ← Symbol centered
│  2    ●  6  │  ← Move (bottom-left), Range (center), Morale (bottom-right)
└──────────────┘
```

**On your question — "how will the user know what numbers mean?"**

Honestly, a physical counter alone is a bit cryptic for new players. Options:
- **A)** Mini legend at the bottom of the tooltip: small row of labels like `ATK·DEF / MOV·RNG·MRL`
- **B)** Hover/tap each number to show its label (too fiddly)
- **C)** The Rules modal (item 4) covers it — reference it from the tooltip with a small "?" icon
- **D)** Labeled on first encounter only (tutorial-style, probably overkill)

**My recommendation:** go with **A** — a tiny legend line below the counter stack. It's compact, always visible, and teaches without interrupting. Real wargamers learn counters by osmosis; new players need the assist.

For multiple units in a hex: stack the counter boxes vertically in the tooltip, up to (say) 3, then "+N more" if there's overflow.

---

**4. Rules modal**
I'll write a proper rulebook. Proposed structure:
- **1.0 Overview** — what the game is, period/setting
- **2.0 Components** — map, units, counters, objectives
- **3.0 Sequence of Play** — Combat → Movement → Rally, both sides
- **4.0 Movement** — MP costs, terrain, broken/suppressed restrictions
- **5.0 Combat** — fire procedure, range, LOS, modifiers, results table
- **6.0 Morale & Rally** — suppressed/broken/eliminated, rally roll
- **7.0 Leaders** — bonus radius, effects
- **8.0 Objectives & Victory** — how objectives are captured, win conditions
- **9.0 Terrain Effects** — quick reference table

**Rules link placement:** small "📋 Rules" button in the header bar, next to SHARE. Opens a scrollable modal overlay.

---

**My questions before I start:**

1. **Phase order edge case:** With Combat first, on Turn 1 the allied player opens with a fire phase where likely nothing is in range. That's a minor UX awkwardness — player just clicks "End Combat." Is that acceptable, or would you prefer Turn 1 starts with Movement (and Combat-first applies from Turn 2 onward)?

2. **Counter tooltip stat labels:** Confirm you want Option A (tiny legend line below the counter stack)?

3. **Range number on counter:** The real Squad Leader counter has range printed separately but small. Should range appear *between* attack and defense on the top row (making it `ATK · RNG · DEF`), or stay in the center-bottom area as I described?

4. **Rules modal scope:** Should it be generic Squad Leader rules, or should it be scenario-specific where some sections (objectives, forces) reflect the loaded scenario?

---

### 16:56 UTC — Ian Branum
> Answers:
> 1. I don't see this as a big deal.
> 2. Optoin A is good.
> 3. Oh, I like your suggestion, let's do that. And it follows the real SL layout.
> 4. Generic, I think. Scenario specific information can be on the play surface.
> Does that all make sense?

---

### 16:56 UTC — Chef
Makes total sense. Clean answers, clear direction. Let me execute all four changes now.

---

### 16:58 UTC — Chef
Now fix the Axis AI to run in the new order (combat → movement → rally):

---

### 16:58 UTC — Chef
Now the big one — TacticalGame.tsx. I'll do all four UI changes at once:

---

### 17:00 UTC — Chef
Now update the main component to add `showRules` state, fix the phase label order, fix the tooltip handler, and add the Rules button + modal:

---

### 17:00 UTC — Chef
Now fix the tooltip handler to collect all units in the hex:

---

### 17:00 UTC — Chef
Now update the phase labels and the Axis AI turn handler (which checks for `movement` phase to trigger):

---

### 17:00 UTC — Chef
Fix the Axis AI trigger — it used to fire after the `rally` phase of allied turn. That's still correct (rally is last phase), but let me verify the condition:

---

### 17:00 UTC — Chef
Good — the Axis AI still triggers correctly after allied rally phase. Now update the tooltip render and add the Rules button + modal to the header:

---

### 17:01 UTC — Chef
Now update the header to say "Squad Leader", add the Rules button, and render the modal:

---

### 17:01 UTC — Chef
Also update the briefing screen header to say "Squad Leader":

---

### 17:01 UTC — Chef
Now build to check for errors:

---

### 17:01 UTC — Chef
Clean build. Let me commit and push:

---

### 17:02 UTC — Chef
Pushed. All four changes are live and Vercel will be deploying now. Here's what shipped:

**1. Squad Leader branding** — header now reads "SQUAD LEADER" in gold, briefing says "SQUAD LEADER — OPERATION BRIEFING". Internal code still uses `tactical` everywhere.

**2. Shoot → Move → Rally** — both for Allied player and Axis AI. Turn 1 opens with the combat phase. The engine, phase cycle, and Axis AI all run in the new order.

**3. Counter tooltips** — hover a hex and you get proper counter cards stacked vertically for each unit. Layout follows real SL: ATK top-left, RNG top-center (small), DEF top-right, NATO symbol center, MOV bottom-left, MRL bottom-right. Status badge (SUP/BRK/✕) appears bottom-center when not normal. Legend line at the bottom reads `ATK · RNG · DEF / MOV · MRL`.

**4. Rules modal** — 📋 RULES button in the header opens a full scrollable rulebook: 10 sections from Overview through Terrain Effects, plus a counter legend with a labeled diagram. Click outside or ✕ to close.

---

### 17:10 UTC — Ian Branum
> Looks great Chef. Thanks! One minor wrinkle that needs to be resolved: when you have a unit selected and then click on another unit to attempt to move the first unit on top of the second unit, instead it selects the second unit. Sometimes. I think if you have unit A selected and when you click on unit B, which is within the movement radius, it should move unit A to stack with unit B rather than selecting unit B. Can you fix that? Also I think we need an undo button in the movement phase. Not in the combat phase. If you accidentally shoot somebody, that's on you. What do you think? Is that a sensible update?

---

### 17:10 UTC — Chef
Both make total sense. Let me look at the exact click handler before writing anything:

---

### 17:11 UTC — Chef
Found it. Two bugs:

1. The unit SVG has its own `onClick` with `stopPropagation` — it intercepts clicks on unit tokens before `handleHexClick` ever sees them, so movement never triggers when clicking directly on a unit's counter.

2. Undo — straightforward: maintain a movement history stack, push before each move, pop on undo, clear when phase ends.

Both are clean, surgical fixes:

---

### 17:12 UTC — Chef
Clear move history when the movement phase ends:

---

### 17:12 UTC — Chef
Also clear history on restart:

---

### 17:12 UTC — Chef
Now fix the `stopPropagation` bug on the unit token — remove it so clicks on a unit counter bubble up to `handleHexClick`, which now correctly prioritizes movement over selection:

---

### 17:12 UTC — Chef
Now add the Undo button in the bottom bar (movement phase only):

---

### 17:13 UTC — Chef
Clean. Commit and push:

---

### 17:13 UTC — Chef
Done. Here's what changed:

**Movement priority fix** — removed the `stopPropagation` on unit counter clicks and rerouted them through `handleHexClick`. Now when you have unit A selected and click on unit B: if B's hex is in the reachable set, A moves there (stacking). If B is outside the reachable set, B gets selected. Priority is always movement first, selection second.

**Undo button** — amber `↩ UNDO` button appears in the bottom bar during the movement phase whenever there's something to undo. Each click steps back one move. The history clears when you end the movement phase, restart, or the phase advances — so you can't undo into a previous turn. Combat phase has no undo as discussed.

---
