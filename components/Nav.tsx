"use client";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Nav() {
  const { data: session } = useSession();

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b"
      style={{ borderColor: "#1e2a4a", background: "#070d20" }}>
      <Link href="/" className="font-orbitron font-black text-sm tracking-widest"
        style={{ color: "#4488ff" }}>
        GAME FORGE
      </Link>

      <div className="flex items-center gap-4">
        {session ? (
          <>
            <Link href="/credits"
              className="text-xs px-3 py-1.5 rounded font-orbitron transition"
              style={{ background: "#ffd70022", border: "1px solid #ffd70044", color: "#ffd700" }}>
              ⚡ {(session.user as { credits?: number }).credits ?? "?"} credits
            </Link>
            <Link href="/credits"
              className="text-xs px-3 py-1.5 rounded font-orbitron transition hover:opacity-80"
              style={{ background: "#4488ff22", border: "1px solid #4488ff44", color: "#4488ff" }}>
              Buy Credits
            </Link>
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-500 hover:text-gray-300 transition">
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn()}
            className="text-xs px-4 py-1.5 rounded font-orbitron transition"
            style={{ background: "#4488ff22", border: "1px solid #4488ff44", color: "#4488ff" }}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}
