"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
  modificationPrompts: string[];
  isPublic: boolean;
  priceToPlay: number;
  priceToClone: number;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selected, setSelected] = useState<ScenarioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [filterView, setFilterView] = useState<"all" | "mine" | "archived">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [archiving, setArchiving] = useState<string | null>(null);

  // Share tooltip
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modify form
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifyError, setModifyError] = useState("");

  // Pricing saved indicator
  const [pricingSaved, setPricingSaved] = useState(false);
  const pricingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playPriceRef = useRef<HTMLInputElement | null>(null);
  const clonePriceRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  const loadScenarios = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterView === "mine") params.set("mine", "true");
    if (filterView === "archived") params.set("archived", "true");
    if (filterCategory !== "all") params.set("category", filterCategory);
    fetch(`/api/scenarios?${params}`)
      .then(r => r.json())
      .then(data => {
        setScenarios(data.scenarios ?? []);
        setCurrentUserId(data.currentUserId ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, filterView, filterCategory]);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const selectScenario = (s: ScenarioSummary) => {
    setSelected(s);
    setModifyPrompt("");
    setModifyError("");
    setCopiedId(null);
    setPricingSaved(false);
  };

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

  const handleShare = () => {
    if (!selected) return;
    const url = `${window.location.origin}/play/${selected.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(selected.id);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleVisibility = async () => {
    if (!selected || selected.userId !== currentUserId) return;
    const next = !selected.isPublic;
    try {
      const res = await fetch(`/api/scenarios/${selected.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelected(prev => (prev ? { ...prev, isPublic: data.isPublic } : prev));
      }
    } catch { /* ignore network errors */ }
  };

  const handleModify = async () => {
    if (!selected || !modifyPrompt.trim()) return;
    setModifying(true);
    setModifyError("");
    try {
      const res = await fetch(`/api/scenarios/${selected.id}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modificationPrompt: modifyPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModifyError(data.error ?? "Modify failed");
        return;
      }
      setModifyPrompt("");
      loadScenarios();
      setSelected(prev =>
        prev && data.scenario ? { ...prev, modificationPrompts: data.scenario.modificationPrompts } : prev
      );
    } catch {
      setModifyError("Something went wrong. Please try again.");
    } finally {
      setModifying(false);
    }
  };

  const handlePricingBlur = async () => {
    if (!selected) return;
    const priceToPlay = Math.max(0, Math.floor(Number(playPriceRef.current?.value) || 0));
    const priceToClone = Math.max(0, Math.floor(Number(clonePriceRef.current?.value) || 0));
    try {
      const res = await fetch(`/api/scenarios/${selected.id}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceToPlay, priceToClone }),
      });
      if (res.ok) {
        setSelected(prev => (prev ? { ...prev, priceToPlay, priceToClone } : prev));
        setPricingSaved(true);
        if (pricingTimer.current) clearTimeout(pricingTimer.current);
        pricingTimer.current = setTimeout(() => setPricingSaved(false), 2000);
      }
    } catch { /* ignore network errors */ }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-orbitron text-xs tracking-widest text-gray-500 animate-pulse">LOADING...</div>
      </div>
    );
  }

  const meta = selected ? (CATEGORY_META[selected.category] ?? CATEGORY_META.tactical) : null;
  const isOwner = selected ? selected.userId === currentUserId : false;
  const showPricing = !!(selected && isOwner && selected.isPublic);
  const allPrompts = selected ? [selected.prompt, ...(selected.modificationPrompts ?? [])] : [];

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
          {/* View cycle: All → Mine → Archived */}
          <button
            onClick={() => setFilterView(v => v === "all" ? "mine" : v === "mine" ? "archived" : "all")}
            className="w-full text-left px-3 py-2 font-orbitron text-xs tracking-widest transition rounded-lg"
            style={{
              border: `1px solid ${filterView !== "all" ? "#4488ff66" : "#1e2a4a"}`,
              background: filterView !== "all" ? "#4488ff11" : "transparent",
              color: filterView === "archived" ? "#f59e0b" : filterView === "mine" ? "#4488ff" : "#6b7280",
            }}>
            {filterView === "mine" ? "👤 MY GAMES" : filterView === "archived" ? "📦 ARCHIVED" : "🌐 ALL GAMES"}
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
            <div className="text-gray-600 text-xs leading-relaxed">{filterView === "archived" ? "No archived games." : "No games found."}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {scenarios.map(s => {
              const m = CATEGORY_META[s.category] ?? CATEGORY_META.tactical;
              const isSelected = selected?.id === s.id;
              const isOwnerOf = s.userId === currentUserId;
              return (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s)}
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
                    {isOwnerOf && (
                      <button
                        onClick={e => handleArchive(e, s.id)}
                        disabled={archiving === s.id}
                        title={filterView === "archived" ? "Restore game" : "Archive game"}
                        className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded transition"
                        style={{
                          color: filterView === "archived" ? "#34d399" : "#ef4444",
                          border: `1px solid ${filterView === "archived" ? "#34d39922" : "#ef444422"}`,
                          background: "transparent",
                          opacity: archiving === s.id ? 0.3 : 0.4,
                          cursor: archiving === s.id ? "not-allowed" : "pointer",
                        }}
                        onMouseEnter={e => { if (archiving !== s.id) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                        onMouseLeave={e => { if (archiving !== s.id) (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; }}>
                        {archiving === s.id ? "…" : filterView === "archived" ? "↩" : "🗄"}
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

                {/* Right column: PLAY + Share + visibility toggle */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Link
                    href={`/play/${selected.id}`}
                    className="px-6 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
                    style={{ background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color, boxShadow: `0 0 20px ${meta.color}22` }}>
                    ▶ PLAY
                  </Link>

                  {/* Share button with Copied! tooltip */}
                  <div className="relative">
                    <button
                      onClick={handleShare}
                      className="font-orbitron text-xs tracking-widest px-4 py-1.5 rounded-lg transition hover:opacity-80"
                      style={{ background: "#4488ff11", border: "1px solid #4488ff33", color: "#9ca3af" }}>
                      SHARE
                    </button>
                    {copiedId === selected.id && (
                      <div
                        className="absolute right-0 top-full mt-1 px-2 py-1 rounded font-orbitron text-[10px] tracking-widest whitespace-nowrap z-30"
                        style={{ background: "#0a1128", border: "1px solid #22c55e44", color: "#22c55e", boxShadow: "0 2px 10px #000a" }}>
                        Copied!
                      </div>
                    )}
                  </div>

                  {/* Public/Private toggle */}
                  <button
                    onClick={handleToggleVisibility}
                    disabled={!isOwner}
                    title={isOwner ? "Toggle public/private" : "Only the owner can change visibility"}
                    className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-full transition-all"
                    style={
                      selected.isPublic
                        ? { background: "#22c55e11", border: "1px solid #22c55e66", color: "#22c55e", boxShadow: "0 0 12px #22c55e22", cursor: isOwner ? "pointer" : "not-allowed", opacity: isOwner ? 1 : 0.5 }
                        : { background: "#6b728011", border: "1px solid #6b728066", color: "#6b7280", cursor: isOwner ? "pointer" : "not-allowed", opacity: isOwner ? 1 : 0.5 }
                    }>
                    {selected.isPublic ? "🌐 PUBLIC" : "🔒 PRIVATE"}
                  </button>
                </div>
              </div>
            </div>

            {/* Your Prompts + Modify */}
            <div className={`px-8 py-6 ${showPricing ? "" : "border-b"}`} style={{ borderColor: "#1e2a4a" }}>
              <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: meta.color }}>YOUR PROMPTS</div>

              <div className="space-y-2 mb-4">
                {allPrompts.map((p, i) => (
                  <div key={i} className="flex gap-2 items-baseline">
                    <span className="text-gray-500 text-sm flex-shrink-0">{i + 1}.</span>
                    <p className="text-gray-300 text-sm leading-relaxed italic flex-1">&ldquo;{p}&rdquo;</p>
                  </div>
                ))}
              </div>

              {isOwner && (
                <div className="mt-4">
                  <div className="font-orbitron text-xs tracking-widest text-gray-500 mt-4 mb-2">MODIFY</div>
                  <textarea
                    rows={3}
                    value={modifyPrompt}
                    onChange={e => setModifyPrompt(e.target.value)}
                    placeholder="Describe what to change about this game…"
                    className="w-full resize-y"
                    style={{
                      background: "#0a1128",
                      border: "1px solid #1e2a4a",
                      color: "#e5e7eb",
                      borderRadius: "0.5rem",
                      padding: "0.5rem",
                      fontFamily: "inherit",
                      fontSize: "0.875rem",
                      outline: "none",
                    }}
                  />
                  <div className="flex items-center justify-end gap-3 mt-2">
                    {modifyError && <span className="text-red-400 text-xs flex-1 text-left">{modifyError}</span>}
                    <button
                      onClick={handleModify}
                      disabled={modifying || !modifyPrompt.trim()}
                      className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color }}>
                      {modifying ? "…" : "MODIFY"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing (owners only, public games only) */}
            {showPricing && (
              <div className="px-8 py-4 border-t mt-auto" style={{ borderColor: "#1e2a4a" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-orbitron text-xs tracking-widest text-gray-500">PRICING</div>
                  <span
                    className="font-orbitron text-[10px] tracking-widest"
                    style={{ color: "#22c55e", opacity: pricingSaved ? 1 : 0, transition: "opacity 0.3s" }}>
                    ✓ SAVED
                  </span>
                </div>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">PRICE TO PLAY</label>
                    <input
                      ref={playPriceRef}
                      key={`play-${selected.id}`}
                      type="number"
                      min={0}
                      defaultValue={selected.priceToPlay}
                      onBlur={handlePricingBlur}
                      className="w-full"
                      style={{
                        background: "#0a1128",
                        border: "1px solid #1e2a4a",
                        color: "#e5e7eb",
                        borderRadius: "0.5rem",
                        padding: "0.5rem",
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">PRICE TO CLONE</label>
                    <input
                      ref={clonePriceRef}
                      key={`clone-${selected.id}`}
                      type="number"
                      min={0}
                      defaultValue={selected.priceToClone}
                      onBlur={handlePricingBlur}
                      className="w-full"
                      style={{
                        background: "#0a1128",
                        border: "1px solid #1e2a4a",
                        color: "#e5e7eb",
                        borderRadius: "0.5rem",
                        padding: "0.5rem",
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-6">⚔️</div>
            <h2 className="font-orbitron font-black text-2xl tracking-widest text-white mb-3">
              WELCOME{session?.user?.name ? `, ${session.user.name.split(" ")[0].toUpperCase()}` : ""}
            </h2>
            <p className="text-gray-500 text-sm max-w-sm mb-8 leading-relaxed">
              {"Select a game from the left to view details, or forge a new one."}
            </p>
            <Link href="/forge"
              className="px-8 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff", boxShadow: "0 0 30px #4488ff22" }}>
              ⚡ FORGE A GAME
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
