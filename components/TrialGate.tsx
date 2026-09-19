"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_COLOR: Record<string, string> = {
  sandbox: "#4488ff",
  tactical: "#f97316",
  narrative: "#a855f7",
  trivia: "#a855f7",
  word: "#22c55e",
  puzzle: "#f59e0b",
  card: "#ef4444",
};

export default function TrialGate({
  scenarioId,
  title,
  priceToPlay,
  priceToClone,
  category,
  isDemo = false,
  children,
}: {
  scenarioId: string;
  title: string;
  priceToPlay: number;
  priceToClone: number;
  category: string;
  isDemo?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const color = CATEGORY_COLOR[category] ?? "#4488ff";

  // Demo games are always open — skip the API check entirely.
  const [status, setStatus] = useState<"checking" | "allowed" | "blocked">(
    isDemo ? "allowed" : "checking"
  );
  const [info, setInfo] = useState({ priceToPlay, priceToClone, title });
  const [busy, setBusy] = useState<null | "play" | "clone">(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isDemo) return; // no API call needed for demos
    let cancelled = false;
    fetch(`/api/play/${scenarioId}/start`, { method: "POST" })
      .then(async res => {
        if (cancelled) return;
        if (res.ok) {
          setStatus("allowed");
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          priceToPlay?: number;
          priceToClone?: number;
          title?: string;
        };
        setInfo({
          priceToPlay: data.priceToPlay ?? priceToPlay,
          priceToClone: data.priceToClone ?? priceToClone,
          title: data.title ?? title,
        });
        setStatus("blocked");
      })
      // Fail open: a transient API error shouldn't lock a player out of a game.
      .catch(() => { if (!cancelled) setStatus("allowed"); });
    return () => { cancelled = true; };
  }, [scenarioId, priceToPlay, priceToClone, title]);

  const purchase = async (type: "PLAY" | "CLONE") => {
    setBusy(type === "PLAY" ? "play" : "clone");
    setError("");
    try {
      const res = await fetch(`/api/marketplace/${scenarioId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Purchase failed. Please try again.");
        setBusy(null);
        return;
      }

      if (type === "PLAY") {
        window.location.reload(); // refresh so credits + gate both reset
        return;
      }

      // CLONE → also create a remix in the buyer's My Games, then land there.
      const cloneRes = await fetch(`/api/marketplace/${scenarioId}/clone`, { method: "POST" });
      if (cloneRes.ok) {
        router.push("/dashboard");
      } else {
        const data = (await cloneRes.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Cloned, but could not open the copy. Find it in My Games.");
        setBusy(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(null);
    }
  };

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]" style={{ background: "#05071a" }}>
        <div className="font-orbitron text-xs tracking-widest text-gray-600 animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (status === "allowed") {
    return <>{children}</>;
  }

  return (
    <div
      className="flex items-center justify-center min-h-[calc(100vh-56px)] px-6 py-12"
      style={{ background: "#05071a" }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: "#070d20", border: `1px solid ${color}44`, boxShadow: `0 0 60px ${color}22` }}>
        <div className="text-4xl mb-4">🔒</div>
        <div className="font-orbitron text-[10px] tracking-[0.3em] mb-2" style={{ color }}>
          FREE TRIAL ENDED
        </div>
        <h1 className="font-orbitron font-black text-xl text-white mb-2">{info.title}</h1>
        <p className="text-gray-500 text-sm mb-6">
          You&apos;ve used all your free sessions. Buy this game to keep playing, or clone it to make it your own.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => purchase("PLAY")}
            disabled={busy !== null}
            className="w-full font-orbitron font-black text-sm tracking-widest py-3 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            style={{ minHeight: "44px", background: `${color}22`, border: `2px solid ${color}66`, color }}>
            {busy === "play" ? "PLEASE WAIT..." : info.priceToPlay > 0 ? `▶ PLAY — ${info.priceToPlay} CREDITS` : "▶ PLAY — FREE"}
          </button>

          <button
            onClick={() => purchase("CLONE")}
            disabled={busy !== null}
            className="w-full font-orbitron text-xs tracking-widest py-3 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            style={{ minHeight: "44px", background: "transparent", border: "1px solid #1e2a4a", color: "#9ca3af" }}>
            {busy === "clone" ? "PLEASE WAIT..." : info.priceToClone > 0 ? `🔀 CLONE — ${info.priceToClone} CREDITS` : "🔀 CLONE — FREE"}
          </button>
        </div>

        <p className="text-gray-700 text-xs mt-6">Credits are shown in the top navigation.</p>
      </div>
    </div>
  );
}
