"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ProfileModal, { getPresetAvatar, initialsFor } from "./ProfileModal";

export default function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isPlay = pathname?.startsWith("/play");

  // Seed from the session value baked into the JWT (instant display, no "?" flash),
  // then refresh from the DB. The JWT copy goes stale after any credit-spending
  // action, so we refetch on every route change.
  const [credits, setCredits] = useState<number | null>(session?.user?.credits ?? null);

  // Local copy of the profile so saves in the modal update the avatar instantly
  // (the JWT keeps the old values until the next sign-in).
  const [profileName, setProfileName] = useState<string | null>(
    session?.user?.displayName ?? null
  );
  const [profileImage, setProfileImage] = useState<string | null>(
    session?.user?.image ?? null
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) {
      setCredits(null);
      setProfileName(null);
      setProfileImage(null);
      setMenuOpen(false);
      setProfileOpen(false);
      return;
    }
    const load = () => {
      fetch("/api/me/credits")
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data?.credits !== undefined) setCredits(data.credits); })
        .catch(() => {});
    };
    load();

    // The JWT carries displayName/image from sign-in time, so pull the current
    // values from the DB as well (otherwise a rename would revert on reload).
    fetch("/api/me/profile")
      .then(r => (r.ok ? r.json() : null))
      .then((data: { displayName?: string | null; name?: string | null; image?: string | null } | null) => {
        if (!data) return;
        setProfileName(data.displayName ?? data.name ?? null);
        setProfileImage(data.image ?? null);
      })
      .catch(() => {});

    // Credit-spending actions inside a modal don't change the pathname, so they
    // fire this event to force an immediate refresh instead.
    window.addEventListener("gf:credits", load);
    return () => window.removeEventListener("gf:credits", load);
  }, [pathname, session?.user]);

  // Keep the avatar in sync when the session itself changes (sign-in/out).
  useEffect(() => {
    setProfileName(session?.user?.displayName ?? null);
    setProfileImage(session?.user?.image ?? null);
  }, [session?.user?.displayName, session?.user?.image]);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const displayCredits = credits !== null ? credits : "?";

  const preset = getPresetAvatar(profileImage);
  const isRemoteImage = !!profileImage && /^https?:\/\//.test(profileImage);
  const initials = initialsFor(profileName, session?.user?.name, session?.user?.email);

  return (
    <>
      <nav className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#1e2a4a", background: "#070d20", minHeight: "56px" }}>

        <div className="flex flex-col items-start gap-0.5">
          <Link
            href={session ? "/dashboard" : "/"}
            className="font-orbitron font-black text-sm tracking-widest transition hover:opacity-80"
            style={{ color: "#4488ff" }}>
            GAME FORGE
          </Link>
          {isPlay && (
            <button
              onClick={() => router.back()}
              className="text-[10px] px-2 py-0.5 rounded font-orbitron font-bold transition hover:opacity-80"
              style={{ background: "#1e2a4a44", border: "1px solid #1e2a4a", color: "#94a3b8" }}>
              ← BACK
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              {!isPlay && (
                <Link href="/forge"
                  className="text-xs px-4 py-1.5 rounded-lg font-orbitron font-bold transition hover:opacity-80"
                  style={{ background: "#4488ff22", border: "1px solid #4488ff44", color: "#4488ff" }}>
                  ⚡ FORGE
                </Link>
              )}
              <Link href="/credits"
                className="text-xs px-3 py-1.5 rounded font-orbitron transition"
                style={{ background: "#ffd70022", border: "1px solid #ffd70044", color: "#ffd700" }}>
                ⚡ {displayCredits} credits
              </Link>

              {/* Avatar + dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden transition hover:opacity-85"
                  style={{
                    background: preset ? `${preset.bg}33` : "#4488ff22",
                    border: `1px solid ${preset ? preset.bg : "#4488ff66"}`,
                  }}>
                  {preset ? (
                    <span className="text-sm leading-none">{preset.emoji}</span>
                  ) : isRemoteImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileImage!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold" style={{ color: "#4488ff" }}>
                      {initials}
                    </span>
                  )}
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-40 rounded-lg overflow-hidden py-1 z-50"
                    style={{ background: "#0b1226", border: "1px solid #1e2a4a", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
                      className="w-full text-left px-4 py-2 text-xs transition hover:bg-[#ffffff0d]"
                      style={{ color: "#c7d2fe" }}>
                      Profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: window.location.origin + "/" })}
                      className="w-full text-left px-4 py-2 text-xs transition hover:bg-[#ffffff0d]"
                      style={{ color: "#94a3b8" }}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="text-xs px-4 py-1.5 rounded font-orbitron transition"
              style={{ background: "#4488ff22", border: "1px solid #4488ff44", color: "#4488ff" }}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      {profileOpen && (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          onSaved={({ displayName, image }) => {
            setProfileName(displayName);
            setProfileImage(image);
          }}
          fallbackName={session?.user?.name}
          fallbackDisplayName={profileName}
          fallbackImage={profileImage}
        />
      )}
    </>
  );
}
