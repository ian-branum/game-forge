"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORY_META: Record<string, { emoji: string; color: string; label: string }> = {
  tactical:  { emoji: "⚔️",  color: "#4488ff", label: "Tactical" },
  trivia:    { emoji: "🧠",  color: "#a855f7", label: "Trivia" },
  word:      { emoji: "📝",  color: "#22c55e", label: "Word" },
  puzzle:    { emoji: "🧩",  color: "#f59e0b", label: "Puzzle" },
  card:      { emoji: "🃏",  color: "#ef4444", label: "Card" },
  narrative: { emoji: "📖",  color: "#f97316", label: "Adventure" },
};

interface ScenarioSummary {
  id: string;
  userId: string;
  title: string;
  category: string;
  prompt: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selected, setSelected] = useState<ScenarioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [filterMine, setFilterMine] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
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
      .catch(() => setLoading(false));
  }, [status, filterMine, filterCategory]);

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArchiving(id);
    try {
      await fetch(`/api/scenarios/${id}/archive`, { method: "PATCH" });
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally {
      setArchiving(null);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-orbitron text-xs tracking-widest text-gray-500 animate-pulse">LOADING...</div>
      </div>
    );
  }

  const meta = selected ? (CATEGORY_META[selected.category] ?? CATEGORY_META.tactical) : null;

  return (
    <div className="flex" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Left nav ─────────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>

        {/* New Game button */}
        <div className="p-3 border-b" style={{ borderColor: "#1e2a4a" }}>
          <Link href="/forge"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-orbitron font-black text-xs tracking-widest transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff", boxShadow: "0 0 15px #4488ff11" }}>
            ⚡ NEW GAME
          </Link>
        </div>

        {/* Credits */}
        <div className="px-3 py-2 border-b flex items-center justify-between"
          style={{ borderColor: "#1e2a4a" }}>
          <span className="text-gray-600 text-xs font-orbitron">CREDITS</span>
          <span className="font-orbitron font-black text-sm" style={{ color: "#ffd700" }}>
            ⚡ {(session?.user as { credits?: number })?.credits ?? "?"}
          </span>
        </div>

        {/* History header */}
        <div className="px-3 pt-3 pb-1">
          <span className="text-gray-600 text-xs font-orbitron tracking-widest">PAST GAMES</span>
        </div>

        {/* Filters */}
        <div className="px-3 pb-2 flex flex-col gap-2 border-b" style={{ borderColor: "#1e2a4a" }}>
          {/* My Games toggle */}
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

          {/* Category selector */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full font-orbitron text-xs tracking-widest rounded-lg px-3 py-2 cursor-pointer"
            style={{
              background: "#0a1128",
              border: "1px solid #1e2a4a",
              color: "#9ca3af",
              outline: "none",
            }}>
            <option value="all">ALL TYPES</option>
            <option value="tactical">⚔️ Tactical</option>
            <option value="trivia">🧠 Trivia</option>
            <option value="word">📝 Word</option>
            <option value="puzzle">🧩 Puzzle</option>
            <option value="card">🃏 Card</option>
            <option value="narrative">📖 Adventure</option>
          </select>
        </div>

        {/* Game list */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="font-orbitron text-xs text-gray-600 animate-pulse">LOADING...</div>
          </div>
        ) : scenarios.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="text-3xl">🎮</div>
            <div className="text-gray-600 text-xs leading-relaxed">No games yet. Forge your first!</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {scenarios.map(s => {
              const m = CATEGORY_META[s.category] ?? CATEGORY_META.tactical;
              const isSelected = selected?.id === s.id;
              const isOwner = s.userId === currentUserId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full text-left px-3 py-3 border-b transition"
                  style={{
                    borderColor: "#1e2a4a",
                    background: isSelected ? `${m.color}11` : "transparent",
                    borderLeft: isSelected ? `3px solid ${m.color}` : "3px solid transparent",
                  }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm flex-shrink-0">{m.emoji}</span>
                    <span className="font-orbitron text-xs font-bold truncate flex-1" style={{ color: isSelected ? m.color : "#9ca3af" }}>
                      {s.title}
                    </span>
                    {isOwner && (
                      <button
                        onClick={e => handleArchive(e, s.id)}
                        disabled={archiving === s.id}
                        title="Archive game"
                        className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded transition"
                        style={{
                          color: "#ef4444",
                          border: "1px solid #ef444422",
                          background: "transparent",
                          opacity: archiving === s.id ? 0.3 : 0.4,
                          cursor: archiving === s.id ? "not-allowed" : "pointer",
                        }}
                        onMouseEnter={e => { if (archiving !== s.id) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                        onMouseLeave={e => { if (archiving !== s.id) (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; }}>
                        {archiving === s.id ? "…" : "🗄"}
                      </button>
                    )}
                  </div>
                  <div className="text-gray-600 text-xs pl-6 truncate">{s.prompt}</div>
                  <div className="text-gray-700 text-xs pl-6 mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#05071a" }}>
        {selected && meta ? (
          <div className="flex flex-col h-full">
            {/* Game detail header */}
            <div className="px-8 py-6 border-b" style={{ borderColor: "#1e2a4a", background: "#070d20" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{meta.emoji}</span>
                    <span className="font-orbitron text-xs tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <h1 className="font-orbitron font-black text-2xl text-white mb-1">{selected.title}</h1>
                  <p className="text-gray-500 text-sm">
                    Forged {new Date(selected.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <Link
                  href={`/play/${selected.id}`}
                  className="flex-shrink-0 px-6 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
                  style={{ background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color, boxShadow: `0 0 20px ${meta.color}22` }}>
                  ▶ PLAY
                </Link>
              </div>
            </div>

            {/* Scenario brief */}
            <div className="px-8 py-6 border-b" style={{ borderColor: "#1e2a4a" }}>
              <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: meta.color }}>YOUR PROMPT</div>
              <p className="text-gray-300 text-sm leading-relaxed italic">&ldquo;{selected.prompt}&rdquo;</p>
            </div>

            {/* Share */}
            <div className="px-8 py-6">
              <div className="font-orbitron text-xs tracking-widest text-gray-600 mb-3">SHARE</div>
              <div className="flex items-center gap-3">
                <code className="text-gray-500 text-xs bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex-1 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/play/${selected.id}` : `game-forge.ai/play/${selected.id}`}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/play/${selected.id}`)}
                  className="px-4 py-2 rounded-lg font-orbitron text-xs tracking-widest transition hover:opacity-80"
                  style={{ background: "#4488ff11", border: "1px solid #4488ff33", color: "#4488ff88" }}>
                  COPY
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-6">⚔️</div>
            <h2 className="font-orbitron font-black text-2xl tracking-widest text-white mb-3">
              WELCOME{session?.user?.name ? `, ${session.user.name.split(" ")[0].toUpperCase()}` : ""}
            </h2>
            <p className="text-gray-500 text-sm max-w-sm mb-8 leading-relaxed">
              {scenarios.length > 0
                ? "Select a game from the left to view details, or forge a new one."
                : "You haven't forged any games yet. Start with a tactical scenario — describe a battle and the AI builds it."}
            </p>
            <Link href="/forge"
              className="px-8 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff", boxShadow: "0 0 30px #4488ff22" }}>
              ⚡ FORGE YOUR FIRST GAME
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
