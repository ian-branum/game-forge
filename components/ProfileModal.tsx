"use client";

import { useEffect, useState } from "react";

export type PresetAvatar = { id: string; emoji: string; bg: string };

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "avatar-1", emoji: "🧑", bg: "#4488ff" },
  { id: "avatar-2", emoji: "👩", bg: "#a855f7" },
  { id: "avatar-3", emoji: "🧙", bg: "#f97316" },
  { id: "avatar-4", emoji: "🤖", bg: "#22c55e" },
  { id: "avatar-5", emoji: "👾", bg: "#ef4444" },
  { id: "avatar-6", emoji: "🦊", bg: "#ffd700" },
  { id: "avatar-7", emoji: "🐉", bg: "#06b6d4" },
  { id: "avatar-8", emoji: "💀", bg: "#6b7280" },
];

export function getPresetAvatar(image: string | null | undefined): PresetAvatar | null {
  if (!image) return null;
  return PRESET_AVATARS.find(a => a.id === image) ?? null;
}

export function initialsFor(
  displayName: string | null | undefined,
  name: string | null | undefined,
  email: string | null | undefined
) {
  const source = displayName?.trim() || name?.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
}

const FIELD_STYLE = {
  background: "#0b1226",
  border: "1px solid #1e2a4a",
  color: "#e5e9f5",
} as const;

const INPUT_CLASS =
  "w-full rounded-lg px-3 py-2 text-sm outline-none transition focus:border-[#4488ff]";

type Props = {
  onClose: () => void;
  onSaved: (profile: { displayName: string | null; image: string | null }) => void;
  /** Session fallbacks shown before the GET resolves. */
  fallbackName?: string | null;
  fallbackDisplayName?: string | null;
  fallbackImage?: string | null;
};

export default function ProfileModal({
  onClose,
  onSaved,
  fallbackName,
  fallbackDisplayName,
  fallbackImage,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [email, setEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  const [displayName, setDisplayName] = useState(fallbackDisplayName ?? "");
  const [image, setImage] = useState<string | null>(fallbackImage ?? null);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Load the authoritative profile (and whether a password exists).
  useEffect(() => {
    let alive = true;
    fetch("/api/me/profile")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("request failed"))))
      .then((data: {
        email?: string;
        name?: string | null;
        displayName?: string | null;
        image?: string | null;
        hasPassword?: boolean;
      }) => {
        if (!alive) return;
        setEmail(data.email ?? null);
        setHasPassword(Boolean(data.hasPassword));
        setDisplayName(prev => prev || data.displayName || data.name || "");
        setImage(prev => prev ?? data.image ?? null);
      })
      .catch(() => { if (alive) setLoadError("Could not load your profile."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Escape closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveProfile = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileError("Display name cannot be empty.");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed, image }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        displayName?: string | null;
        image?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setProfileError(data.error ?? "Could not save your profile.");
        return;
      }
      const nextName = data.displayName ?? trimmed;
      const nextImage = data.image ?? null;
      setDisplayName(nextName);
      setImage(nextImage);
      onSaved({ displayName: nextName, image: nextImage });
      // Nav listens for this and refreshes the credit balance (which also
      // re-renders the avatar with the new name/image).
      window.dispatchEvent(new Event("gf:credits"));
      setProfileSaved(true);
    } catch {
      setProfileError("Network error — please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Fill in all three password fields.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPasswordError(data.error ?? "Could not change your password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch {
      setPasswordError("Network error — please try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const previewAvatar = getPresetAvatar(image);
  const initials = initialsFor(displayName, fallbackName, email);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh] pb-8"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div
        className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxHeight: "76vh",
          background: "#070d20",
          border: "1px solid #1e2a4a",
          boxShadow: "0 0 60px #4488ff18",
        }}>

        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0 border-b"
          style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
          <div className="flex items-center gap-3 min-w-0">
            {previewAvatar ? (
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${previewAvatar.bg}33`, border: `1px solid ${previewAvatar.bg}` }}>
                {previewAvatar.emoji}
              </span>
            ) : (
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "#4488ff22", border: "1px solid #4488ff66", color: "#4488ff" }}>
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-orbitron font-bold text-sm tracking-widest" style={{ color: "#4488ff" }}>
                PROFILE
              </h2>
              {email && (
                <p className="text-xs truncate" style={{ color: "#64748b" }}>{email}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none transition hover:opacity-70 flex-shrink-0"
            style={{ color: "#64748b" }}
            aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          {loading && (
            <p className="text-xs" style={{ color: "#64748b" }}>Loading…</p>
          )}
          {loadError && (
            <p className="text-xs" style={{ color: "#f87171" }}>{loadError}</p>
          )}

          {/* ── Profile section ── */}
          <section className="space-y-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#64748b" }}>
              Display name
            </h3>
            <input
              type="text"
              value={displayName}
              maxLength={40}
              onChange={e => { setDisplayName(e.target.value); setProfileSaved(false); }}
              placeholder="How should we call you?"
              className={INPUT_CLASS}
              style={FIELD_STYLE}
            />

            <h3 className="text-[11px] font-bold tracking-widest uppercase pt-1" style={{ color: "#64748b" }}>
              Avatar
            </h3>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_AVATARS.map(a => {
                const selected = image === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setImage(selected ? null : a.id); setProfileSaved(false); }}
                    className="aspect-square rounded-full flex items-center justify-center text-lg transition hover:scale-105"
                    style={{
                      background: `${a.bg}${selected ? "55" : "22"}`,
                      border: `2px solid ${selected ? a.bg : `${a.bg}44`}`,
                      boxShadow: selected ? `0 0 12px ${a.bg}66` : undefined,
                    }}
                    title={selected ? "Deselect avatar" : "Use this avatar"}
                    aria-pressed={selected}>
                    {a.emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px]" style={{ color: "#475569" }}>
              {image ? "Click the selected avatar again to go back to your initials." : "No preset selected — showing your initials."}
            </p>

            {profileError && (
              <p className="text-xs" style={{ color: "#f87171" }}>{profileError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileSaving || loading}
                className="text-xs px-4 py-2 rounded-lg font-orbitron font-bold transition disabled:opacity-50"
                style={{ background: "#4488ff22", border: "1px solid #4488ff88", color: "#4488ff" }}>
                {profileSaving ? "SAVING…" : "SAVE PROFILE"}
              </button>
              {profileSaved && (
                <span className="text-xs" style={{ color: "#22c55e" }}>Saved ✓</span>
              )}
            </div>
          </section>

          {/* ── Password section (credentials users only) ── */}
          {hasPassword && (
            <section className="space-y-3 pt-5 border-t" style={{ borderColor: "#1e2a4a" }}>
              <h3 className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#64748b" }}>
                Change password
              </h3>
              <input
                type="password"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPasswordSaved(false); }}
                placeholder="Current password"
                autoComplete="current-password"
                className={INPUT_CLASS}
                style={FIELD_STYLE}
              />
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordSaved(false); }}
                placeholder="New password (min. 8 characters)"
                autoComplete="new-password"
                className={INPUT_CLASS}
                style={FIELD_STYLE}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordSaved(false); }}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className={INPUT_CLASS}
                style={FIELD_STYLE}
              />

              {passwordError && (
                <p className="text-xs" style={{ color: "#f87171" }}>{passwordError}</p>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={savePassword}
                  disabled={passwordSaving}
                  className="text-xs px-4 py-2 rounded-lg font-orbitron font-bold transition disabled:opacity-50"
                  style={{ background: "#1e2a4a", border: "1px solid #2b3b63", color: "#c7d2fe" }}>
                  {passwordSaving ? "UPDATING…" : "UPDATE PASSWORD"}
                </button>
                {passwordSaved && (
                  <span className="text-xs" style={{ color: "#22c55e" }}>Password updated ✓</span>
                )}
              </div>
            </section>
          )}

          {!hasPassword && !loading && (
            <p className="text-[11px] pt-4 border-t" style={{ borderColor: "#1e2a4a", color: "#475569" }}>
              You sign in with Google, so there is no password to change.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
