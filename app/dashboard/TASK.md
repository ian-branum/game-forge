# TASK: Dashboard Left Nav — Filters + Archive Button

## File to edit
`app/dashboard/page.tsx`

## What the API returns (already updated)
GET /api/scenarios returns:
```json
{
  "scenarios": [{ "id", "userId", "title", "category", "prompt", "createdAt" }],
  "currentUserId": "<string>"
}
```
Query params supported: `?mine=true` and `?category=tactical` (etc).
Archived scenarios are excluded server-side.

Archive endpoint: `PATCH /api/scenarios/<id>/archive` — no body required.

## Changes needed

### 1. State

Add to component state:
```ts
const [currentUserId, setCurrentUserId] = useState<string>("");
const [filterMine, setFilterMine] = useState(false);
const [filterCategory, setFilterCategory] = useState<string>("all");
```

### 2. Fetch

Update the fetch call to pass query params:
```ts
const params = new URLSearchParams();
if (filterMine) params.set("mine", "true");
if (filterCategory !== "all") params.set("category", filterCategory);
fetch(`/api/scenarios?${params}`)
  .then(r => r.json())
  .then(data => {
    setScenarios(data.scenarios ?? []);
    setCurrentUserId(data.currentUserId ?? "");
    setLoading(false);
  })
```

The fetch should re-run when `filterMine` or `filterCategory` changes (add them to the useEffect dependency array).

### 3. Filter controls UI

Place these controls between the "PAST GAMES" header and the game list.
Style them to match the dark theme (`#060b1a` bg, Orbitron font, glowing borders).

**My Games toggle:**
A small pill toggle. When OFF shows "ALL GAMES", when ON shows "MY GAMES".
Active state: `#4488ff` border + tint. Inactive: `#1e2a4a` border.

```tsx
<button
  onClick={() => setFilterMine(v => !v)}
  className="w-full text-left px-3 py-2 font-orbitron text-xs tracking-widest transition rounded-lg"
  style={{
    border: `1px solid ${filterMine ? "#4488ff66" : "#1e2a4a"}`,
    background: filterMine ? "#4488ff11" : "transparent",
    color: filterMine ? "#4488ff" : "#6b7280",
  }}>
  {filterMine ? "👤 MY GAMES" : "🌐 ALL GAMES"}
</button>
```

**Category selector:**
A `<select>` styled to match the theme. Options:
- value="" or "all" → "ALL TYPES"
- "tactical" → "⚔️ Tactical"
- "trivia" → "🧠 Trivia"
- "word" → "📝 Word"
- "puzzle" → "🧩 Puzzle"
- "card" → "🃏 Card"
- "narrative" → "📖 Adventure"

Style:
```tsx
<select
  value={filterCategory}
  onChange={e => setFilterCategory(e.target.value)}
  className="w-full font-orbitron text-xs tracking-widest rounded-lg px-3 py-2"
  style={{
    background: "#0a1128",
    border: "1px solid #1e2a4a",
    color: "#9ca3af",
    outline: "none",
  }}>
```

Wrap both controls in a `<div className="px-3 py-2 flex flex-col gap-2">` placed right after the "PAST GAMES" label div.

### 4. Archive button

In the scenario list, for each game where `s.userId === currentUserId`, render a small archive button to the right of the game title row.

The button should:
- Be a small icon button (🗄️ or `▾` archive icon), positioned at the far right of the first line
- On click: call `PATCH /api/scenarios/<id>/archive`, then remove the game from local state (optimistic update — splice it out of scenarios array)
- Stop propagation so it doesn't select the game
- Show a brief loading state (disable while in-flight)

Example:
```tsx
{s.userId === currentUserId && (
  <button
    onClick={async (e) => {
      e.stopPropagation();
      await fetch(`/api/scenarios/${s.id}/archive`, { method: "PATCH" });
      setScenarios(prev => prev.filter(x => x.id !== s.id));
      if (selected?.id === s.id) setSelected(null);
    }}
    title="Archive game"
    className="ml-auto flex-shrink-0 text-xs px-1.5 py-0.5 rounded opacity-40 hover:opacity-100 transition"
    style={{ color: "#ef4444", border: "1px solid #ef444422", background: "transparent" }}>
    🗄
  </button>
)}
```

Place it inside the `.flex items-center gap-2 mb-0.5` div, after the title span.

## ScenarioSummary type update

Add `userId` to the interface:
```ts
interface ScenarioSummary {
  id: string;
  userId: string;
  title: string;
  category: string;
  prompt: string;
  createdAt: string;
}
```

## Notes
- Keep all existing styles intact — only add new elements
- The filter controls should only appear in the nav (not the main panel)
- No external libraries — plain React state
- "use client" directive is already at the top

## Output
Rewrite `app/dashboard/page.tsx` with all the above changes applied cleanly.
