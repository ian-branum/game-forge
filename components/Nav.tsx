"use client";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const isPlay = pathname?.startsWith("/play");

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
      style={{ borderColor: "#1e2a4a", background: "#070d20", height: "56px" }}>

      <Link
        href={session ? "/dashboard" : "/"}
        className="font-orbitron font-black text-sm tracking-widest transition hover:opacity-80"
        style={{ color: "#4488ff" }}>
        GAME FORGE
      </Link>

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
              ⚡ {(session.user as { credits?: number }).credits ?? "?"} credits
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-gray-500 hover:text-gray-300 transition">
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="text-xs px-4 py-1.5 rounded font-orbitron transition"
            style={{ background: "#4488ff22", border: "1px solid #4488ff44", color: "#4488ff" }}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}
