# TASK: Live credit balance in Nav

## Problem
Credits in the nav are read from `session.user.credits` — a value baked into the JWT at sign-in. It never refreshes, so the displayed balance goes stale after any credit-spending action (forge, modify, regenerate, freefix).

## Fix

Two small changes — no auth.ts changes, no polling loops.

---

## 1. New route: `GET /api/me/credits`

Create `/app/api/me/credits/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true },
  });
  return NextResponse.json({ credits: user?.credits ?? 0 });
}
```

---

## 2. Nav.tsx — fetch live credits

Replace the static `session.user.credits` read with a live fetch. Refetch whenever `pathname` changes (catches post-forge and post-modify navigation automatically).

```tsx
"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPlay = pathname?.startsWith("/play");

  const [credits, setCredits] = useState<number | null>(
    (session?.user as { credits?: number })?.credits ?? null
  );

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/me/credits")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.credits !== undefined) setCredits(data.credits); })
      .catch(() => {});
  }, [pathname, session?.user]);

  const displayCredits = credits !== null ? credits : "?";

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
              ⚡ {displayCredits} credits
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-gray-500 hover:text-gray-300 transition">
              Sign Out
            </button>
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
  );
}
```

Key behaviours:
- Initialises from session (instant display, no flash to "?")
- Refetches from DB on every route change via `pathname` dep
- Falls back to "?" if unauthenticated or fetch fails (same as before)

---

## Scope
- `app/api/me/credits/route.ts` — new file
- `components/Nav.tsx` — live fetch replacing static session read

## Acceptance
- After forging a game and landing on /play/[id], credits in nav reflect the deducted amount
- After a modify or regenerate in the dashboard modal, navigating away and back updates the count
- No visible flash or layout shift (initial value comes from session, update is seamless)
- Unauthenticated users unaffected
