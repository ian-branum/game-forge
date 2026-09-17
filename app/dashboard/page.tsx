"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORY_META: Record<string, { emoji: string; color: string; label: string }> = {
  sandbox:   { emoji: "🎮",  color: "#4488ff", label: "Games & Puzzles" },
  tactical:  { emoji: "⚔️",  color: "#f97316", label: "WW2 Tactical" },
  narrative: { emoji: "📖",  color: "#a855f7", label: "Adventure" },
  // Legacy categories — still renderable for existing saved games
  trivia:    { emoji: "🧠",  color: "#a855f7", label: "Trivia" },
  word:      { emoji: "📝",  color: "#22c55e", label: "Word" },
  puzzle:    { emoji: "🧩",  color: "#f59e0b", label: "Puzzle" },
  card:      { emoji: "🃏",  color: "#ef4444", label: "Card" },
};

interface GameVersion {
  id: string;
  versionNum: number;
  prompt: string;
  createdAt: string;
}

interface ScenarioSummary {
  id: string;
  userId: string;
  title: string;
  category: string;
  prompt: string;
  isPublic: boolean;
  priceToPlay: number;
  priceToClone: number;
  activeVersionId: string | null;
  versions: GameVersion[];
  createdAt: string;
}

// ─── Modify Modal ────────────────────────────────────────────────────────────

function ModifyModal({
  scenario,
  currentUserId,
  onClose,
  onModified,
}: {
  scenario: ScenarioSummary;
  currentUserId: string;
  onClose: () => void;
  onModified: (updated: ScenarioSummary) => void;
}) {
  const meta = CATEGORY_META[scenario.category] ?? CATEGORY_META.tactical;
  const isOwner = scenario.userId === currentUserId;

  const [versions, setVersions] = useState<GameVersion[]>(scenario.versions ?? []);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(scenario.activeVersionId ?? null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);

  const [modifyPrompt, setModifyPrompt] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifyError, setModifyError] = useState("");

  const [copiedId, setCopiedId] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPublic, setIsPublic] = useState(scenario.isPublic);
  const [priceToPlay, setPriceToPlay] = useState(scenario.priceToPlay ?? 0);
  const [priceToClone, setPriceToClone] = useState(scenario.priceToClone ?? 0);
  const [pricingSaved, setPricingSaved] = useState(false);
  const pricingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPricing = !!(isOwner && isPublic);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleShare = () => {
    const url = `${window.location.origin}/play/${scenario.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedId(false), 2000);
  };

  const handleToggleVisibility = async () => {
    if (!isOwner) return;
    const next = !isPublic;
    const res = await fetch(`/api/scenarios/${scenario.id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    if (res.ok) setIsPublic(next);
  };

  const handleModify = async () => {
    if (!modifyPrompt.trim()) return;
    setModifying(true);
    setModifyError("");
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modificationPrompt: modifyPrompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) { setModifyError("Not enough credits"); return; }
      if (!res.ok) { setModifyError(data.error ?? "Modify failed"); return; }
      const newVersion = data.version as GameVersion | undefined;
      if (newVersion) {
        setModifyPrompt("");
        const updated = [...versions, newVersion];
        setVersions(updated);
        setActiveVersionId(newVersion.id);
        onModified({ ...scenario, activeVersionId: newVersion.id, versions: updated, isPublic });
      }
    } catch {
      setModifyError("Something went wrong. Please try again.");
    } finally {
      setModifying(false);
    }
  };

  const handleSetActive = async (versionId: string) => {
    setSettingActiveId(versionId);
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/versions/${versionId}`, { method: "PATCH" });
      if (res.ok) setActiveVersionId(versionId);
    } finally {
      setSettingActiveId(null);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    const prevVersions = versions;
    const prevActive = activeVersionId;
    setVersions(prev => prev.filter(v => v.id !== versionId));
    setDeletingVersionId(versionId);
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/versions/${versionId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setVersions(prevVersions); setActiveVersionId(prevActive); return; }
      const nextActive = (data.newActiveVersionId as string | null) ?? prevActive;
      if (data.newActiveVersionId !== undefined) setActiveVersionId(nextActive);
    } catch {
      setVersions(prevVersions);
      setActiveVersionId(prevActive);
    } finally {
      setDeletingVersionId(null);
    }
  };

  const handlePricingBlur = async () => {
    const play = Math.max(0, Math.floor(priceToPlay || 0));
    const clone = Math.max(0, Math.floor(priceToClone || 0));
    const res = await fetch(`/api/scenarios/${scenario.id}/pricing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceToPlay: play, priceToClone: clone }),
    });
    if (res.ok) {
      setPricingSaved(true);
      if (pricingTimer.current) clearTimeout(pricingTimer.current);
      pricingTimer.current = setTimeout(() => setPricingSaved(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#070d20", border: `1px solid ${meta.color}44`, boxShadow: `0 0 60px ${meta.color}22` }}>

        {/* Modal header */}
        <div className="px-6 py-4 border-b flex items-start justify-between gap-4 flex-shrink-0"
          style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{meta.emoji}</span>
              <span className="font-orbitron text-xs tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
            </div>
            <h2 className="font-orbitron font-black text-xl text-white">{scenario.title}</h2>
            <p className="text-gray-600 text-xs mt-1">
              Forged {new Date(scenario.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Share */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="font-orbitron text-xs tracking-widest px-3 py-1.5 rounded-lg transition hover:opacity-80"
                style={{ background: "#4488ff11", border: "1px solid #4488ff33", color: "#9ca3af" }}>
                SHARE
              </button>
              {copiedId && (
                <div className="absolute right-0 top-full mt-1 px-2 py-1 rounded font-orbitron text-[10px] tracking-widest whitespace-nowrap z-30"
                  style={{ background: "#0a1128", border: "1px solid #22c55e44", color: "#22c55e" }}>
                  Copied!
                </div>
              )}
            </div>

            {/* Visibility */}
            <button
              onClick={handleToggleVisibility}
              disabled={!isOwner}
              className="font-orbitron text-xs tracking-widest px-3 py-1.5 rounded-full transition-all"
              style={isPublic
                ? { background: "#22c55e11", border: "1px solid #22c55e66", color: "#22c55e", cursor: isOwner ? "pointer" : "not-allowed" }
                : { background: "#6b728011", border: "1px solid #6b728066", color: "#6b7280", cursor: isOwner ? "pointer" : "not-allowed", opacity: isOwner ? 1 : 0.5 }}>
              {isPublic ? "🌐 PUBLIC" : "🔒 PRIVATE"}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="ml-2 text-gray-500 hover:text-white transition text-xl leading-none"
              style={{ fontFamily: "sans-serif" }}>
              ×
            </button>
          </div>
        </div>

        {/* Modal body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Original prompt */}
          <div>
            <div className="font-orbitron text-[10px] tracking-widest text-gray-500 mb-1">ORIGINAL PROMPT</div>
            <p className="text-gray-300 text-sm leading-relaxed italic">&ldquo;{scenario.prompt}&rdquo;</p>
          </div>

          {/* Version history */}
          <div>
            <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: meta.color }}>
              VERSION HISTORY
            </div>
            {versions.length === 0 ? (
              <p className="text-gray-600 text-sm italic">No revisions yet.</p>
            ) : (
              <div className="space-y-0 divide-y" style={{ borderColor: "#1e2a4a" }}>
                {versions.map(v => {
                  const isActive = v.id === activeVersionId;
                  const isDeleting = deletingVersionId === v.id;
                  const isSettingActive = settingActiveId === v.id;
                  return (
                    <div key={v.id} className="flex items-center gap-3 py-2.5">
                      <span className="font-orbitron text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                        style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}44`, color: meta.color }}>
                        V{v.versionNum}
                      </span>
                      <p className="text-gray-300 text-sm leading-relaxed italic flex-1 min-w-0 break-words">
                        &ldquo;{v.prompt}&rdquo;
                      </p>
                      {isActive && (
                        <span className="font-orbitron text-[10px] tracking-widest px-2 py-1 rounded-full flex-shrink-0"
                          style={{ background: "#22c55e11", border: "1px solid #22c55e55", color: "#22c55e" }}>
                          ● ACTIVE
                        </span>
                      )}
                      {isOwner && (
                        <>
                          {!isActive && (
                            <button
                              onClick={() => handleSetActive(v.id)}
                              disabled={isSettingActive}
                              className="font-orbitron text-[10px] tracking-widest px-2 py-1 rounded flex-shrink-0 transition disabled:opacity-40"
                              style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}66`, color: meta.color }}>
                              {isSettingActive ? "…" : "SET ACTIVE"}
                            </button>
                          )}
                          {versions.length > 1 && (
                            <button
                              onClick={() => handleDeleteVersion(v.id)}
                              disabled={isDeleting}
                              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 transition"
                              style={{ color: "#ef4444", border: "1px solid #ef444422", background: "transparent", opacity: isDeleting ? 0.3 : 0.4, cursor: isDeleting ? "not-allowed" : "pointer" }}
                              onMouseEnter={e => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                              onMouseLeave={e => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; }}>
                              {isDeleting ? "…" : "🗑"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modify */}
          {isOwner && (
            <div>
              <div className="font-orbitron text-xs tracking-widest text-gray-500 mb-2">MODIFY</div>
              <textarea
                rows={3}
                value={modifyPrompt}
                onChange={e => setModifyPrompt(e.target.value)}
                placeholder="Describe what to change about this game…"
                className="w-full resize-y"
                style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#e5e7eb", borderRadius: "0.5rem", padding: "0.5rem", fontFamily: "inherit", fontSize: "0.875rem", outline: "none" }}
              />
              <div className="flex items-center justify-end gap-3 mt-2">
                {modifyError && <span className="text-red-400 text-xs flex-1">{modifyError}</span>}
                <button
                  onClick={handleModify}
                  disabled={modifying || !modifyPrompt.trim()}
                  className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color }}>
                  {modifying ? "FORGING…" : "MODIFY"}
                </button>
              </div>
            </div>
          )}

          {/* Pricing */}
          {showPricing && (
            <div className="border-t pt-4" style={{ borderColor: "#1e2a4a" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-orbitron text-xs tracking-widest text-gray-500">PRICING</div>
                <span className="font-orbitron text-[10px] tracking-widest" style={{ color: "#22c55e", opacity: pricingSaved ? 1 : 0, transition: "opacity 0.3s" }}>✓ SAVED</span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">PRICE TO PLAY</label>
                  <input type="number" min={0} value={priceToPlay} onChange={e => setPriceToPlay(Number(e.target.value))} onBlur={handlePricingBlur}
                    className="w-full" style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#e5e7eb", borderRadius: "0.5rem", padding: "0.5rem", fontFamily: "inherit", fontSize: "0.875rem", outline: "none" }} />
                </div>
                <div className="flex-1">
                  <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">PRICE TO CLONE</label>
                  <input type="number" min={0} value={priceToClone} onChange={e => setPriceToClone(Number(e.target.value))} onBlur={handlePricingBlur}
                    className="w-full" style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#e5e7eb", borderRadius: "0.5rem", padding: "0.5rem", fontFamily: "inherit", fontSize: "0.875rem", outline: "none" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer — Play button */}
        <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end" style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
          <Link
            href={`/play/${scenario.id}`}
            className="px-6 py-2.5 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
            style={{ background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color, boxShadow: `0 0 20px ${meta.color}22` }}>
            ▶ PLAY
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [filterView, setFilterView] = useState<"all" | "mine" | "archived">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [archiving, setArchiving] = useState<string | null>(null);
  const [modalScenario, setModalScenario] = useState<ScenarioSummary | null>(null);

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

  useEffect(() => { loadScenarios(); }, [loadScenarios]);

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArchiving(id);
    try {
      await fetch(`/api/scenarios/${id}/archive`, { method: "PATCH" });
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (modalScenario?.id === id) setModalScenario(null);
    } finally {
      setArchiving(null);
    }
  };

  const handleModified = (updated: ScenarioSummary) => {
    setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
    setModalScenario(updated);
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-orbitron text-xs tracking-widest text-gray-500 animate-pulse">LOADING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]" style={{ background: "#05071a" }}>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-6 py-3 border-b flex items-center gap-4 flex-wrap"
        style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>

        <Link href="/forge"
          className="flex items-center gap-2 px-5 py-2 rounded-xl font-orbitron font-black text-xs tracking-widest transition-all hover:scale-[1.02] flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff" }}>
          ⚡ NEW GAME
        </Link>

        <span className="font-orbitron text-xs tracking-widest flex-shrink-0" style={{ color: "#ffd700" }}>
          ⚡ {(session?.user as { credits?: number })?.credits ?? "?"} credits
        </span>

        <div className="flex-1" />

        {/* View filter */}
        <button
          onClick={() => setFilterView(v => v === "all" ? "mine" : v === "mine" ? "archived" : "all")}
          className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-lg transition flex-shrink-0"
          style={{
            border: `1px solid ${filterView !== "all" ? "#4488ff66" : "#1e2a4a"}`,
            background: filterView !== "all" ? "#4488ff11" : "transparent",
            color: filterView === "archived" ? "#f59e0b" : filterView === "mine" ? "#4488ff" : "#6b7280",
          }}>
          {filterView === "mine" ? "👤 MY GAMES" : filterView === "archived" ? "📦 ARCHIVED" : "🌐 ALL GAMES"}
        </button>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="font-orbitron text-xs tracking-widest rounded-lg px-3 py-2 cursor-pointer flex-shrink-0"
          style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#9ca3af", outline: "none" }}>
          <option value="all">ALL TYPES</option>
          <option value="sandbox">🎮 Games &amp; Puzzles</option>
          <option value="tactical">⚔️ WW2 Tactical</option>
          <option value="narrative">📖 Adventure</option>
        </select>
      </div>

      {/* ── Game table ─────────────────────────────────────────────────── */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="font-orbitron text-xs text-gray-600 animate-pulse">LOADING...</div>
          </div>
        ) : scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="text-5xl">🎮</div>
            <div className="font-orbitron text-gray-600 text-sm">
              {filterView === "archived" ? "No archived games." : "No games found."}
            </div>
            {filterView !== "archived" && (
              <Link href="/forge"
                className="mt-2 px-6 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff" }}>
                ⚡ FORGE A GAME
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "#1e2a4a" }}>
                {["TYPE", "TITLE", "PROMPT", "CREATED", "VERSIONS", "VISIBILITY", "ACTIONS"].map(h => (
                  <th key={h} className="text-left pb-3 font-orbitron text-[10px] tracking-widest text-gray-600 pr-4 last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => {
                const m = CATEGORY_META[s.category] ?? CATEGORY_META.sandbox;
                const isOwnerOf = s.userId === currentUserId;
                return (
                  <tr
                    key={s.id}
                    className="border-b transition"
                    style={{ borderColor: "#1e2a4a11" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#ffffff05")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                    {/* Type */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="font-orbitron text-xs font-bold" style={{ color: m.color }}>
                        {m.emoji} {m.label}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="py-3 pr-4 max-w-[200px]">
                      <span className="font-orbitron text-xs font-bold text-white truncate block">
                        {s.title}
                      </span>
                    </td>

                    {/* Prompt */}
                    <td className="py-3 pr-4 max-w-xs">
                      <span className="text-gray-500 text-xs italic truncate block">
                        {s.prompt}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="text-gray-600 text-xs">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </td>

                    {/* Versions */}
                    <td className="py-3 pr-4 text-center">
                      <span className="font-orbitron text-xs text-gray-500">
                        {(s.versions?.length ?? 0) + 1}
                      </span>
                    </td>

                    {/* Visibility */}
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="font-orbitron text-[10px] tracking-widest px-2 py-1 rounded-full"
                        style={s.isPublic
                          ? { background: "#22c55e11", border: "1px solid #22c55e44", color: "#22c55e" }
                          : { background: "#6b728011", border: "1px solid #6b728033", color: "#6b7280" }}>
                        {s.isPublic ? "🌐 PUBLIC" : "🔒 PRIVATE"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Play */}
                        <Link
                          href={`/play/${s.id}`}
                          className="font-orbitron text-[10px] tracking-widest px-3 py-1.5 rounded-lg transition hover:opacity-90"
                          style={{ background: `${m.color}22`, border: `1px solid ${m.color}55`, color: m.color }}>
                          ▶ PLAY
                        </Link>

                        {/* Modify */}
                        <button
                          onClick={() => setModalScenario(s)}
                          className="font-orbitron text-[10px] tracking-widest px-3 py-1.5 rounded-lg transition hover:opacity-90"
                          style={{ background: "#4488ff11", border: "1px solid #4488ff44", color: "#4488ff" }}>
                          ✏ MODIFY
                        </button>

                        {/* Archive (owners only) */}
                        {isOwnerOf && (
                          <button
                            onClick={e => handleArchive(e, s.id)}
                            disabled={archiving === s.id}
                            title={filterView === "archived" ? "Restore" : "Archive"}
                            className="font-orbitron text-[10px] tracking-widest px-2 py-1.5 rounded-lg transition"
                            style={{
                              background: "transparent",
                              border: `1px solid ${filterView === "archived" ? "#34d39922" : "#ef444422"}`,
                              color: filterView === "archived" ? "#34d399" : "#ef4444",
                              opacity: archiving === s.id ? 0.3 : 0.5,
                              cursor: archiving === s.id ? "not-allowed" : "pointer",
                            }}
                            onMouseEnter={e => { if (archiving !== s.id) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                            onMouseLeave={e => { if (archiving !== s.id) (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}>
                            {archiving === s.id ? "…" : filterView === "archived" ? "↩" : "🗄"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modify Modal ───────────────────────────────────────────────── */}
      {modalScenario && (
        <ModifyModal
          scenario={modalScenario}
          currentUserId={currentUserId}
          onClose={() => setModalScenario(null)}
          onModified={handleModified}
        />
      )}
    </div>
  );
}
