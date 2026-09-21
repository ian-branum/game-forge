"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  description: string | null;
  creator: string;
  category: string;
  prompt: string;
  isPublic: boolean;
  isClonable: boolean;
  clonesMayRepublish: boolean;
  priceToPlay: number;
  priceToClone: number;
  freePlayLimit: number;
  adventureSubtype: string | null;
  activeVersionId: string | null;
  versions: GameVersion[];
  createdAt: string;
  archived: boolean;
}

interface PlayScenario {
  id: string;
  title: string;
  description: string | null;
  category: string;
  creator: string;
  createdAt: string;
  lineage: { displayName: string; scenarioId: string }[];
}

interface MarketplaceScenario {
  id: string;
  title: string;
  description: string | null;
  category: string;
  creator: string;
  priceToPlay: number;
  priceToClone: number;
  freePlayLimit: number;
  adventureSubtype: string | null;
  isPublic: boolean;
  isClonable: boolean;
  clonesMayRepublish: boolean;
  createdAt: string;
  versionCount: number;
  lineage: { displayName: string; scenarioId: string }[];
  userStatus: {
    trialCount: number;
    hasPlayLicense: boolean;
    hasCloneLicense: boolean;
    canTrial: boolean;
  };
}

const inputStyle: React.CSSProperties = {
  background: "#0a1128",
  border: "1px solid #1e2a4a",
  color: "#e5e7eb",
  borderRadius: "0.5rem",
  padding: "0.5rem",
  fontFamily: "inherit",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

const PILL_ACTIVE = { background: "#4488ff22", border: "1px solid #4488ff66", color: "#4488ff" };
const PILL_INACTIVE = { background: "transparent", border: "1px solid #1e2a4a", color: "#6b7280" };

const ADVENTURE_SUBTYPES = [
  { id: "fixed", label: "Fixed Story" },
  { id: "infinite", label: "Infinite Replay" },
  { id: "mystery", label: "Mystery" },
];

// Creator/lineage names route to the Buy tab filtered by that creator.
const creatorUrl = (name: string) => `/dashboard?tab=buy&creator=${encodeURIComponent(name)}`;

// ─── Modify Modal ────────────────────────────────────────────────────────────

function ModifyModal({
  scenario,
  currentUserId,
  onClose,
  onModified,
  onArchived,
}: {
  scenario: ScenarioSummary;
  currentUserId: string;
  onClose: () => void;
  onModified: (updated: ScenarioSummary) => void;
  onArchived: (id: string) => void;
}) {
  const meta = CATEGORY_META[scenario.category] ?? CATEGORY_META.sandbox;
  const isOwner = scenario.userId === currentUserId;

  const [versions, setVersions] = useState<GameVersion[]>(scenario.versions ?? []);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(scenario.activeVersionId ?? null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Editable title / description
  const [title, setTitle] = useState(scenario.title);
  const [description, setDescription] = useState(scenario.description ?? "");
  const [detailsSaved, setDetailsSaved] = useState(false);
  const detailsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modifyPrompt, setModifyPrompt] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifyError, setModifyError] = useState("");

  const [copiedId, setCopiedId] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Publish / marketplace settings
  const [pubPublic, setPubPublic] = useState(scenario.isPublic);
  const [pubClonable, setPubClonable] = useState(scenario.isClonable ?? false);
  const [pubRepublish, setPubRepublish] = useState(scenario.clonesMayRepublish ?? true);
  const [pubPriceToPlay, setPubPriceToPlay] = useState(scenario.priceToPlay ?? 0);
  const [pubPriceToClone, setPubPriceToClone] = useState(scenario.priceToClone ?? 0);
  const [pubFreePlay, setPubFreePlay] = useState(scenario.freePlayLimit ?? 1);
  const [pubAdventure, setPubAdventure] = useState(scenario.adventureSubtype ?? "fixed");
  const [pubSaving, setPubSaving] = useState(false);
  const [pubSaved, setPubSaved] = useState(false);
  const [pubError, setPubError] = useState("");
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubInitRef = useRef(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const flashDetailsSaved = () => {
    setDetailsSaved(true);
    if (detailsTimer.current) clearTimeout(detailsTimer.current);
    detailsTimer.current = setTimeout(() => setDetailsSaved(false), 2000);
  };

  const handleDetailsBlur = async () => {
    if (!isOwner) return;
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const payload: { title?: string; description?: string } = {};
    if (trimmedTitle !== scenario.title && trimmedTitle.length >= 1) payload.title = trimmedTitle;
    if (trimmedDesc !== (scenario.description ?? "")) payload.description = trimmedDesc;
    if (Object.keys(payload).length === 0) return;

    const res = await fetch(`/api/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { title?: string; description?: string | null };
      const nextTitle = data.title ?? trimmedTitle;
      const nextDescription = data.description ?? null;
      setTitle(nextTitle);
      setDescription(nextDescription ?? "");
      flashDetailsSaved();
      onModified({ ...scenario, title: nextTitle, description: nextDescription });
    }
  };

  const handleArchiveFromModal = async () => {
    setArchiving(true);
    try {
      await fetch(`/api/scenarios/${scenario.id}/archive`, { method: "PATCH" });
      onArchived(scenario.id);
      onClose();
    } finally {
      setArchiving(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/play/${scenario.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedId(false), 2000);
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
        onModified({ ...scenario, title, description: description.trim() || null, activeVersionId: newVersion.id, versions: updated, isPublic: pubPublic });
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

  const savePublish = async (overrides?: Partial<{
    isPublic: boolean; isClonable: boolean; clonesMayRepublish: boolean;
    priceToPlay: number; priceToClone: number; freePlayLimit: number; adventureSubtype: string;
  }>) => {
    const payload = {
      isPublic: overrides?.isPublic ?? pubPublic,
      isClonable: overrides?.isClonable ?? pubClonable,
      clonesMayRepublish: overrides?.clonesMayRepublish ?? pubRepublish,
      priceToPlay: overrides?.priceToPlay ?? pubPriceToPlay,
      priceToClone: overrides?.priceToClone ?? pubPriceToClone,
      freePlayLimit: overrides?.freePlayLimit ?? pubFreePlay,
      adventureSubtype: scenario.category === "narrative"
        ? (overrides?.adventureSubtype ?? pubAdventure)
        : undefined,
    };
    setPubSaving(true);
    setPubError("");
    try {
      const res = await fetch(`/api/scenarios/${scenario.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPubError(data.error ?? "Could not save publishing settings."); return; }
      setPubSaved(true);
      if (pubTimer.current) clearTimeout(pubTimer.current);
      pubTimer.current = setTimeout(() => setPubSaved(false), 2000);
      onModified({ ...scenario, ...payload, adventureSubtype: payload.adventureSubtype ?? scenario.adventureSubtype });
    } catch {
      setPubError("Something went wrong. Please try again.");
    } finally {
      setPubSaving(false);
    }
  };

  // Auto-save publish settings whenever they change (skip initial mount)
  useEffect(() => {
    if (!pubInitRef.current) { pubInitRef.current = true; return; }
    const t = setTimeout(() => savePublish(), 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubPublic, pubClonable, pubRepublish, pubPriceToPlay, pubPriceToClone, pubFreePlay, pubAdventure]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) { e.stopPropagation(); onClose(); } }}>

      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#070d20", border: `1px solid ${meta.color}44`, boxShadow: `0 0 60px ${meta.color}22` }}>

        {/* Modal header */}
        <div className="px-6 py-4 border-b flex items-start justify-between gap-4 flex-shrink-0"
          style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{meta.emoji}</span>
              <span className="font-orbitron text-xs tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
              {pubPublic && (
                <span className="font-orbitron text-[10px] tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: "#22c55e11", border: "1px solid #22c55e44", color: "#22c55e" }}>
                  🌐 PUBLIC
                </span>
              )}
            </div>
            <h2 className="font-orbitron font-black text-xl text-white truncate">{title || scenario.title}</h2>
            <p className="text-gray-600 text-xs mt-1">
              Forged {new Date(scenario.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
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

            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              className="ml-2 text-gray-500 hover:text-white transition text-xl leading-none"
              style={{ fontFamily: "sans-serif" }}>
              ×
            </button>
          </div>
        </div>

        {/* Modal body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Editable title + description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-orbitron text-xs tracking-widest" style={{ color: meta.color }}>DETAILS</div>
              <span className="font-orbitron text-[10px] tracking-widest" style={{ color: "#22c55e", opacity: detailsSaved ? 1 : 0, transition: "opacity 0.3s" }}>✓ SAVED</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">TITLE</label>
                <input
                  type="text"
                  value={title}
                  readOnly={!isOwner}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleDetailsBlur}
                  className="w-full"
                  style={{ ...inputStyle, opacity: isOwner ? 1 : 0.7 }}
                />
              </div>
              <div>
                <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">DESCRIPTION</label>
                <textarea
                  rows={2}
                  value={description}
                  readOnly={!isOwner}
                  onChange={e => setDescription(e.target.value)}
                  onBlur={handleDetailsBlur}
                  placeholder="No description yet."
                  className="w-full resize-y"
                  style={{ ...inputStyle, opacity: isOwner ? 1 : 0.7 }}
                />
                <p className="text-gray-600 text-xs mt-1">Shown to other players in the marketplace</p>
              </div>
            </div>
          </div>

          {/* Original prompt */}
          <div className="border-t pt-4" style={{ borderColor: "#1e2a4a" }}>
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
                style={{ ...inputStyle }}
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

          {/* Publish */}
          {isOwner && (
            <div className="border-t pt-4" style={{ borderColor: "#1e2a4a" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-orbitron text-xs tracking-widest" style={{ color: meta.color }}>
                  PUBLISH TO MARKETPLACE
                </div>
                <span className="font-orbitron text-[10px] tracking-widest" style={{ color: "#22c55e", opacity: pubSaved ? 1 : 0, transition: "opacity 0.3s" }}>✓ SAVED</span>
              </div>

              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={pubPublic}
                  onChange={e => setPubPublic(e.target.checked)}
                  className="w-4 h-4 accent-[#4488ff]"
                />
                <span className="text-sm text-gray-300">Make public</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={pubClonable}
                  onChange={e => {
                    setPubClonable(e.target.checked);
                    if (e.target.checked && pubPriceToClone < pubPriceToPlay) {
                      setPubPriceToClone(pubPriceToPlay);
                    }
                  }}
                  className="w-4 h-4 accent-[#4488ff]"
                />
                <span className="text-sm text-gray-300">Allow cloning</span>
              </label>

              {pubClonable && (
                <div className="ml-7 mb-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pubRepublish}
                      onChange={e => setPubRepublish(e.target.checked)}
                      className="w-4 h-4 accent-[#4488ff]"
                    />
                    <span className="text-sm text-gray-300">Allow clones to be republished</span>
                  </label>
                  <p className="text-gray-600 text-xs mt-2">
                    If unchecked, players who clone this game cannot publish their fork publicly.
                  </p>
                </div>
              )}

              {pubPublic && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">PRICE TO PLAY</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} value={pubPriceToPlay}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setPubPriceToPlay(val);
                            if (pubPriceToClone < val) setPubPriceToClone(val);
                          }}
                          style={{ ...inputStyle }} />
                        <span className="text-gray-500 text-xs flex-shrink-0">credits</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-1">PRICE TO CLONE</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} value={pubPriceToClone}
                          disabled={!pubClonable}
                          onChange={e => setPubPriceToClone(Number(e.target.value))}
                          style={{ ...inputStyle, opacity: pubClonable ? 1 : 0.35, cursor: pubClonable ? "auto" : "not-allowed" }} />
                        <span className="text-gray-500 text-xs flex-shrink-0">credits</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-2">FREE TRIAL</label>
                    <div className="flex items-center gap-2">
                      {[1, 3].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPubFreePlay(n)}
                          className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-lg transition"
                          style={pubFreePlay === n
                            ? { background: `${meta.color}22`, border: `1px solid ${meta.color}66`, color: meta.color }
                            : { background: "transparent", border: "1px solid #1e2a4a", color: "#6b7280" }}>
                          {n} SESSION{n > 1 ? "S" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  {scenario.category === "narrative" && (
                    <div>
                      <label className="block font-orbitron text-xs tracking-widest text-gray-500 mb-2">ADVENTURE TYPE</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ADVENTURE_SUBTYPES.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setPubAdventure(s.id)}
                            className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-lg transition"
                            style={pubAdventure === s.id
                              ? { background: `${meta.color}22`, border: `1px solid ${meta.color}66`, color: meta.color }
                              : { background: "transparent", border: "1px solid #1e2a4a", color: "#6b7280" }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pubError && <p className="text-red-400 text-xs mt-3">{pubError}</p>}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t flex-shrink-0 flex items-center justify-between gap-3" style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
          {isOwner ? (
            <button
              onClick={e => { e.stopPropagation(); handleArchiveFromModal(); }}
              disabled={archiving}
              className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-lg transition disabled:cursor-not-allowed"
              style={{ color: "#6b7280", border: "1px solid #374151", background: "transparent", opacity: archiving ? 0.4 : 1 }}>
              {archiving ? "…" : scenario.archived ? "↩ RESTORE" : "🗄 ARCHIVE"}
            </button>
          ) : (
            <span />
          )}
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

// ─── Lineage chain (shared by Play + Buy cards) ───────────────────────────────

function LineageChain({
  lineage,
  onNameClick,
}: {
  lineage: { displayName: string; scenarioId: string }[];
  onNameClick: (name: string) => void;
}) {
  if (lineage.length <= 1) return null;
  return (
    <div className="text-[11px] text-gray-700 flex flex-wrap items-center gap-1 mb-3">
      {lineage.map((l, i) => (
        <span key={`${l.scenarioId}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span>→</span>}
          <button
            onClick={() => onNameClick(l.displayName)}
            className="hover:text-[#4488ff] underline">
            {l.displayName}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Play tab card ────────────────────────────────────────────────────────────

function PlayCard({ s }: { s: PlayScenario }) {
  const meta = CATEGORY_META[s.category] ?? CATEGORY_META.sandbox;
  const router = useRouter();

  return (
    <div className="rounded-2xl p-4 flex flex-col"
      style={{ background: "#070d20", border: "1px solid #1e2a4a", borderRadius: "1rem" }}>
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-orbitron text-[10px] tracking-widest" style={{ color: meta.color }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="font-orbitron font-black text-white text-base leading-snug mb-1">{s.title}</h3>
      {s.description && <p className="text-gray-500 text-xs italic mb-3 line-clamp-2">{s.description}</p>}

      {/* Creator */}
      <div className="text-xs text-gray-600 mb-1">
        By{" "}
        <button
          onClick={() => router.push(creatorUrl(s.creator))}
          className="text-gray-400 hover:text-[#4488ff] underline">
          {s.creator}
        </button>
      </div>

      {/* Lineage */}
      <LineageChain lineage={s.lineage} onNameClick={name => router.push(creatorUrl(name))} />

      {/* Play */}
      <div className="mt-auto pt-3">
        <Link
          href={`/play/${s.id}`}
          className="block w-full text-center font-orbitron font-black text-xs tracking-widest py-2.5 rounded-lg transition hover:scale-[1.02]"
          style={{ minHeight: "44px", lineHeight: "24px", background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color }}>
          ▶ PLAY
        </Link>
      </div>
    </div>
  );
}

// ─── Buy tab card ─────────────────────────────────────────────────────────────

function BuyCard({
  s,
  busy,
  error,
  onTry,
  onBuy,
}: {
  s: MarketplaceScenario;
  busy: string | null;
  error: string;
  onTry: () => void;
  onBuy: (type: "PLAY" | "CLONE") => void;
}) {
  const meta = CATEGORY_META[s.category] ?? CATEGORY_META.sandbox;
  const router = useRouter();
  const trialsLeft = Math.max(0, s.freePlayLimit - s.userStatus.trialCount);

  return (
    <div className="rounded-2xl p-4 flex flex-col"
      style={{ background: "#070d20", border: "1px solid #1e2a4a", borderRadius: "1rem" }}>
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-orbitron text-[10px] tracking-widest px-2 py-1 rounded-full"
          style={{ background: "#4488ff11", border: "1px solid #4488ff55", color: "#4488ff" }}>
          {s.userStatus.trialCount > 0 ? `TRIAL ${trialsLeft}/${s.freePlayLimit} LEFT` : "FREE TRIAL"}
        </span>
        <span className="font-orbitron text-[10px] tracking-widest" style={{ color: meta.color }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="font-orbitron font-black text-white text-base leading-snug mb-1">{s.title}</h3>
      {s.description && <p className="text-gray-500 text-xs italic mb-3 line-clamp-2">{s.description}</p>}

      {/* Creator */}
      <div className="text-xs text-gray-600 mb-1">
        By{" "}
        <button
          onClick={() => router.push(creatorUrl(s.creator))}
          className="text-gray-400 hover:text-[#4488ff] underline">
          {s.creator}
        </button>
      </div>

      {/* Lineage */}
      <LineageChain lineage={s.lineage} onNameClick={name => router.push(creatorUrl(name))} />

      <div className="text-[11px] text-gray-600 mb-3">
        {s.versionCount} version{s.versionCount === 1 ? "" : "s"} · {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {/* Actions */}
      <div className="mt-auto space-y-2">
        {s.userStatus.canTrial && (
          <button
            onClick={onTry}
            disabled={busy !== null}
            className="w-full font-orbitron text-[10px] tracking-widest py-2.5 rounded-lg transition hover:opacity-90 disabled:opacity-40"
            style={{ minHeight: "44px", background: "transparent", border: `1px solid ${meta.color}44`, color: meta.color }}>
            {busy === "try" ? "…" : `▶ TRY FREE (${trialsLeft} remaining)`}
          </button>
        )}

        <button
          onClick={() => onBuy("PLAY")}
          disabled={busy !== null}
          className="w-full font-orbitron font-black text-xs tracking-widest py-2.5 rounded-lg transition hover:scale-[1.02] disabled:opacity-40"
          style={{ minHeight: "44px", background: `${meta.color}22`, border: `2px solid ${meta.color}66`, color: meta.color }}>
          {busy === "buy-play" ? "…" : s.priceToPlay > 0 ? `▶ BUY TO PLAY — ${s.priceToPlay} CREDITS` : "▶ GET TO PLAY — FREE"}
        </button>

        {s.isClonable && (
          <button
            onClick={() => onBuy("CLONE")}
            disabled={busy !== null}
            className="w-full font-orbitron text-[10px] tracking-widest py-2.5 rounded-lg transition hover:opacity-90 disabled:opacity-40"
            style={{ minHeight: "44px", background: "transparent", border: "1px solid #1e2a4a", color: "#9ca3af" }}>
            {busy === "buy-clone" ? "…" : s.priceToClone > 0 ? `⬇ CLONE — ${s.priceToClone} CREDITS` : "⬇ CLONE — FREE"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard (Suspense-wrapped so useSearchParams stays static-render safe) ──

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-orbitron text-xs tracking-widest text-gray-500 animate-pulse">LOADING...</div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}

type Tab = "play" | "build" | "buy";

function DashboardInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("play");
  const [archivedView, setArchivedView] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [modalScenario, setModalScenario] = useState<ScenarioSummary | null>(null);

  // Play tab state
  const [playScenarios, setPlayScenarios] = useState<PlayScenario[]>([]);
  const [playLoading, setPlayLoading] = useState(false);
  const [playCategory, setPlayCategory] = useState<string>("all");

  // Buy tab state
  const [market, setMarket] = useState<MarketplaceScenario[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketCategory, setMarketCategory] = useState<string>("all");
  const [marketSort, setMarketSort] = useState<"newest" | "popular">("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [cardBusy, setCardBusy] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  // Read ?tab= and ?creator= from the URL on load / navigation.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "buy" || tabParam === "play" || tabParam === "build") {
      setActiveTab(tabParam);
    }
    const creatorParam = searchParams.get("creator");
    if (creatorParam) {
      setCreatorFilter(decodeURIComponent(creatorParam));
    }
  }, [searchParams]);

  // Debounce the marketplace search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Build tab loader (my own scenarios) ──
  const loadScenarios = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (archivedView) params.set("archived", "true");
    if (filterCategory !== "all") params.set("category", filterCategory);
    fetch(`/api/scenarios?${params}`)
      .then(r => r.json())
      .then(data => {
        setScenarios(data.scenarios ?? []);
        setCurrentUserId(data.currentUserId ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, archivedView, filterCategory]);

  useEffect(() => { loadScenarios(); }, [loadScenarios]);

  // ── Play tab loader (my own ∪ licensed originals) ──
  const loadPlay = useCallback(() => {
    if (status !== "authenticated" || activeTab !== "play") return;
    setPlayLoading(true);
    const params = new URLSearchParams({ mode: "play" });
    if (playCategory !== "all") params.set("category", playCategory);
    fetch(`/api/scenarios?${params}`)
      .then(r => r.json())
      .then(data => {
        setPlayScenarios(data.scenarios ?? []);
        setPlayLoading(false);
      })
      .catch(() => setPlayLoading(false));
  }, [status, activeTab, playCategory]);

  useEffect(() => { loadPlay(); }, [loadPlay]);

  // ── Buy tab loader (other people's public, unowned games) ──
  const loadMarketplace = useCallback(() => {
    if (status !== "authenticated" || activeTab !== "buy") return;
    setMarketLoading(true);
    const params = new URLSearchParams();
    if (marketCategory !== "all") params.set("category", marketCategory);
    params.set("sort", marketSort);
    if (search.trim()) params.set("q", search.trim());
    if (creatorFilter.trim()) params.set("creator", creatorFilter.trim());
    fetch(`/api/marketplace?${params}`)
      .then(r => r.json())
      .then(data => {
        setMarket(data.scenarios ?? []);
        setMarketLoading(false);
      })
      .catch(() => setMarketLoading(false));
  }, [status, activeTab, marketCategory, marketSort, search, creatorFilter]);

  useEffect(() => { loadMarketplace(); }, [loadMarketplace]);

  const handleModified = (updated: ScenarioSummary) => {
    setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
    setModalScenario(updated);
  };

  const clearCreatorFilter = () => {
    setCreatorFilter("");
    router.replace("/dashboard?tab=buy");
  };

  const handleTry = async (s: MarketplaceScenario) => {
    setCardBusy(`try:${s.id}`);
    setCardError(null);
    try {
      const res = await fetch(`/api/play/${s.id}/start`, { method: "POST" });
      if (res.ok) {
        router.push(`/play/${s.id}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setCardError({ id: s.id, message: data.error ?? "Could not start this game." });
      setCardBusy(null);
    } catch {
      setCardError({ id: s.id, message: "Something went wrong." });
      setCardBusy(null);
    }
  };

  // Buy/Clone: on success the game becomes owned, so it drops out of the Buy tab.
  const handleBuy = async (s: MarketplaceScenario, type: "PLAY" | "CLONE") => {
    setCardBusy(`${type === "PLAY" ? "buy-play" : "buy-clone"}:${s.id}`);
    setCardError(null);
    try {
      const res = await fetch(`/api/marketplace/${s.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCardError({ id: s.id, message: data.error ?? "Purchase failed." });
        setCardBusy(null);
        return;
      }

      if (type === "CLONE") {
        const cloneRes = await fetch(`/api/marketplace/${s.id}/clone`, { method: "POST" });
        if (!cloneRes.ok) {
          const data = (await cloneRes.json().catch(() => ({}))) as { error?: string };
          setCardError({ id: s.id, message: data.error ?? "Cloned, but the copy could not be created." });
          setCardBusy(null);
          return;
        }
      }

      setMarket(prev => prev.filter(c => c.id !== s.id));
      setCardBusy(null);
    } catch {
      setCardError({ id: s.id, message: "Something went wrong." });
      setCardBusy(null);
    }
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

      {/* ── Tabs bar (section selector) ────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 border-b px-6 py-3 flex items-center gap-2"
        style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
        <button
          onClick={() => setActiveTab("play")}
          className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-full transition"
          style={activeTab === "play" ? PILL_ACTIVE : PILL_INACTIVE}>
          PLAY
        </button>
        <button
          onClick={() => setActiveTab("build")}
          className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-full transition"
          style={activeTab === "build" ? PILL_ACTIVE : PILL_INACTIVE}>
          BUILD
        </button>
        <button
          onClick={() => setActiveTab("buy")}
          className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-full transition"
          style={activeTab === "buy" ? PILL_ACTIVE : PILL_INACTIVE}>
          BUY
        </button>
      </div>

      {/* ── Build filters bar ──────────────────────────────────────────── */}
      {activeTab === "build" && (
        <div
          className="sticky top-[56px] z-10 border-b px-6 py-2.5 flex items-center gap-3 flex-wrap"
          style={{ borderColor: "#0d1530", background: "#05071a" }}>
          <span className="font-orbitron text-[9px] tracking-[0.3em] text-gray-700 uppercase flex-shrink-0">
            BUILD
          </span>

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

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setArchivedView(false)}
              className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-full transition"
              style={!archivedView
                ? { background: "#4488ff22", border: "1px solid #4488ff66", color: "#4488ff" }
                : PILL_INACTIVE}>
              ACTIVE
            </button>
            <button
              onClick={() => setArchivedView(true)}
              className="font-orbitron text-xs tracking-widest px-4 py-2 rounded-full transition"
              style={archivedView
                ? { background: "#f59e0b22", border: "1px solid #f59e0b66", color: "#f59e0b" }
                : PILL_INACTIVE}>
              ARCHIVED
            </button>
          </div>

          <div className="flex-1" />
        </div>
      )}

      {/* ── Play filters bar ───────────────────────────────────────────── */}
      {activeTab === "play" && (
        <div
          className="sticky top-[56px] z-10 border-b px-6 py-2.5 flex items-center gap-3 flex-wrap"
          style={{ borderColor: "#0d1530", background: "#05071a" }}>
          <span className="font-orbitron text-[9px] tracking-[0.3em] text-gray-700 uppercase flex-shrink-0">
            PLAY
          </span>

          <select
            value={playCategory}
            onChange={e => setPlayCategory(e.target.value)}
            className="font-orbitron text-xs tracking-widest rounded-lg px-3 py-2 cursor-pointer flex-shrink-0"
            style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#9ca3af", outline: "none" }}>
            <option value="all">ALL TYPES</option>
            <option value="sandbox">🎮 Games &amp; Puzzles</option>
            <option value="tactical">⚔️ WW2 Tactical</option>
            <option value="narrative">📖 Adventure</option>
          </select>
        </div>
      )}

      {/* ── Buy filters bar ────────────────────────────────────────────── */}
      {activeTab === "buy" && (
        <div
          className="sticky top-[56px] z-10 border-b px-6 py-2.5 flex items-center gap-3 flex-wrap"
          style={{ borderColor: "#0d1530", background: "#05071a" }}>
          <span className="font-orbitron text-[9px] tracking-[0.3em] text-gray-700 uppercase flex-shrink-0">
            BUY
          </span>

          <select
            value={marketCategory}
            onChange={e => setMarketCategory(e.target.value)}
            className="font-orbitron text-xs tracking-widest rounded-lg px-3 py-2 cursor-pointer flex-shrink-0"
            style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#9ca3af", outline: "none" }}>
            <option value="all">ALL TYPES</option>
            <option value="sandbox">🎮 Games &amp; Puzzles</option>
            <option value="tactical">⚔️ WW2 Tactical</option>
            <option value="narrative">📖 Adventure</option>
          </select>

          <select
            value={marketSort}
            onChange={e => setMarketSort(e.target.value as "newest" | "popular")}
            className="font-orbitron text-xs tracking-widest rounded-lg px-3 py-2 cursor-pointer flex-shrink-0"
            style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#9ca3af", outline: "none" }}>
            <option value="newest">NEWEST</option>
            <option value="popular">POPULAR</option>
          </select>

          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search games…"
            className="flex-1 min-w-[160px] rounded-lg px-3 py-2 text-sm"
            style={{ background: "#0a1128", border: "1px solid #1e2a4a", color: "#e5e7eb", outline: "none" }}
          />

          {creatorFilter && (
            <span
              className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-full flex items-center gap-2 flex-shrink-0"
              style={{ background: "#4488ff22", border: "1px solid #4488ff66", color: "#4488ff" }}>
              Games by: {creatorFilter}
              <button
                onClick={clearCreatorFilter}
                className="hover:text-white transition"
                style={{ fontFamily: "sans-serif", lineHeight: 1 }}>
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── PLAY tab ───────────────────────────────────────────────────── */}
      {activeTab === "play" && (
        <div className="px-6 py-6">
          {playLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="font-orbitron text-xs text-gray-600 animate-pulse">LOADING...</div>
            </div>
          ) : playScenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="text-5xl">🎮</div>
              <div className="font-orbitron text-gray-600 text-sm">Nothing to play yet.</div>
              <p className="text-gray-700 text-xs">Forge a game in Build, or buy one in the marketplace.</p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setActiveTab("build")}
                  className="px-6 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff" }}>
                  ⚡ BUILD A GAME
                </button>
                <button
                  onClick={() => setActiveTab("buy")}
                  className="px-6 py-3 rounded-xl font-orbitron text-sm tracking-widest transition-all hover:scale-105"
                  style={{ background: "transparent", border: "2px solid #1e2a4a", color: "#9ca3af" }}>
                  🏪 BROWSE MARKETPLACE
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playScenarios.map(s => <PlayCard key={s.id} s={s} />)}
            </div>
          )}
        </div>
      )}

      {/* ── BUILD tab ──────────────────────────────────────────────────── */}
      {activeTab === "build" && (
        <div className="px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="font-orbitron text-xs text-gray-600 animate-pulse">LOADING...</div>
            </div>
          ) : scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="text-5xl">🎮</div>
              <div className="font-orbitron text-gray-600 text-sm">
                {archivedView ? "No archived games." : "No games found."}
              </div>
              {!archivedView && (
                <Link href="/forge"
                  className="mt-2 px-6 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff" }}>
                  ⚡ FORGE A GAME
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "#1e2a4a" }}>
                    {["TYPE", "TITLE", "DESCRIPTION", "CREATOR", "CREATED", "VERSIONS", "VISIBILITY"].map(h => (
                      <th key={h} className="text-left pb-3 font-orbitron text-[10px] tracking-widest text-gray-600 pr-4 last:pr-0 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(s => {
                    const m = CATEGORY_META[s.category] ?? CATEGORY_META.sandbox;
                    return (
                      <tr
                        key={s.id}
                        className="border-b transition cursor-pointer"
                        style={{ borderColor: "#1e2a4a11" }}
                        onClick={() => setModalScenario(s)}
                        onMouseEnter={e => (e.currentTarget.style.background = "#4488ff08")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span className="font-orbitron text-xs font-bold" style={{ color: m.color }}>
                            {m.emoji} {m.label}
                          </span>
                        </td>

                        <td className="py-3 pr-4 max-w-[180px]">
                          <span className="font-orbitron text-xs font-bold text-white truncate block">
                            {s.title}
                          </span>
                        </td>

                        <td className="py-3 pr-4 max-w-[240px]">
                          {s.description ? (
                            <span className="text-gray-500 text-xs italic truncate block">
                              {s.description}
                            </span>
                          ) : (
                            <span className="text-gray-700 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-3 pr-4 max-w-[120px]">
                          <span className="text-gray-500 text-xs truncate block">
                            {s.creator}
                          </span>
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span className="text-gray-600 text-xs">
                            {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>

                        <td className="py-3 pr-4 text-center">
                          <span className="font-orbitron text-xs text-gray-500">
                            {(s.versions?.length ?? 0) + 1}
                          </span>
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span className="font-orbitron text-[10px] tracking-widest px-2 py-1 rounded-full"
                            style={s.isPublic
                              ? { background: "#22c55e11", border: "1px solid #22c55e44", color: "#22c55e" }
                              : { background: "#6b728011", border: "1px solid #6b728033", color: "#6b7280" }}>
                            {s.isPublic ? "🌐 PUBLIC" : "🔒 PRIVATE"}
                          </span>
                        </td>


                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BUY tab ────────────────────────────────────────────────────── */}
      {activeTab === "buy" && (
        <div className="px-6 py-6">
          {marketLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="font-orbitron text-xs text-gray-600 animate-pulse">LOADING...</div>
            </div>
          ) : market.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="text-5xl">🏪</div>
              <div className="font-orbitron text-gray-600 text-sm">
                {creatorFilter ? `No games by ${creatorFilter}.` : "No games published yet."}
              </div>
              <p className="text-gray-700 text-xs">
                {creatorFilter ? "Try clearing the creator filter." : "Publish one of your games to be the first."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {market.map(s => (
                <BuyCard
                  key={s.id}
                  s={s}
                  busy={cardBusy?.endsWith(s.id) ? cardBusy.split(":")[0] : null}
                  error={cardError?.id === s.id ? cardError.message : ""}
                  onTry={() => handleTry(s)}
                  onBuy={type => handleBuy(s, type)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modify Modal ───────────────────────────────────────────────── */}
      {modalScenario && (
        <ModifyModal
          scenario={modalScenario}
          currentUserId={currentUserId}
          onClose={() => setModalScenario(null)}
          onModified={handleModified}
          onArchived={id => setScenarios(prev => prev.filter(s => s.id !== id))}
        />
      )}
    </div>
  );
}
