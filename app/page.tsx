"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface DemoScenario {
  id: string;
  title: string;
  category: string;
}

interface Demos {
  tactical: DemoScenario[];
  sandbox: DemoScenario[];
}

const ENGINES = [
  {
    id: "sandbox",
    emoji: "🎮",
    label: "Games & Puzzles",
    color: "#4488ff",
    desc: "Any board, card, or puzzle game — chess, checkers, Go, solitaire, Sudoku, or invent your own with custom pieces and rules. The AI generates a fully playable game from your description.",
  },
  {
    id: "tactical",
    emoji: "⚔️",
    label: "WW2 Tactical",
    color: "#f97316",
    desc: "Hex-based squad combat with line-of-sight, morale, and authentic WW2 scenarios. Describe the battle — beach assault, urban fighting, bridge defence — and the AI sets the stage.",
  },
  {
    id: "narrative",
    emoji: "📖",
    label: "Adventure",
    color: "#a855f7",
    desc: "Branching narrative adventures driven by an AI opponent that adapts to your choices. Coming soon.",
    soon: true,
  },
];

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [demos, setDemos] = useState<Demos | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    fetch("/api/demos")
      .then(r => r.json())
      .then(setDemos)
      .catch(() => {});
  }, []);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-orbitron text-xs tracking-widest text-gray-500 animate-pulse">LOADING...</div>
      </div>
    );
  }

  return (
    <main className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="flex flex-col items-center justify-center text-center px-6 py-24"
        style={{ background: "linear-gradient(180deg, #070d20 0%, #05071a 100%)", borderBottom: "1px solid #1e2a4a" }}>

        <div className="font-orbitron text-xs tracking-[0.4em] text-gray-500 mb-4 uppercase">
          AI · Games · On Demand
        </div>

        <h1
          className="font-orbitron font-black tracking-widest text-white mb-4"
          style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 1.05 }}>
          GAME
          <span style={{ color: "#4488ff" }}> FORGE</span>
        </h1>

        <p className="text-gray-300 text-lg max-w-xl mb-2">
          Describe any game in plain English.
        </p>
        <p className="text-gray-500 text-base max-w-xl mb-10">
          AI generates a unique, fully playable game in seconds — any board game, any variant, any rules.
        </p>

        <button
          onClick={() => router.push("/login")}
          className="flex items-center gap-3 px-8 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #4488ff33, #4488ff55)", border: "2px solid #4488ff", color: "#4488ff", boxShadow: "0 0 30px #4488ff33" }}>
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
            <path d="M43.6 20.2H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.8z" fill="#4488ff" opacity="0.7" />
          </svg>
          Get Started · Free
        </button>

        <p className="text-gray-600 text-xs mt-4">
          3 free games on signup · No credit card required
        </p>

        <a
          href="#how-it-works"
          className="mt-10 text-gray-600 hover:text-gray-400 text-xs font-orbitron tracking-widest transition flex flex-col items-center gap-2">
          SEE HOW IT WORKS
          <span className="animate-bounce">↓</span>
        </a>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="flex justify-center py-12 px-6 border-b"
        style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full text-center">
          {[
            { n: "01", icon: "🖊️", title: "Describe It", body: "Type any game or scenario in plain English. Chess on a 10×10 board, a Pacific island assault, your own invented rules." },
            { n: "02", icon: "⚡", title: "AI Forges It", body: "Our AI generates a complete, playable game in seconds — board, rules, AI opponent, everything." },
            { n: "03", icon: "🎮", title: "Play & Modify", body: "Jump straight in. Tweak anything with a follow-up prompt — new pieces, different rules, bigger board." },
          ].map(step => (
            <div key={step.n} className="flex flex-col items-center">
              <div className="font-orbitron text-xs text-gray-600 mb-2 tracking-widest">{step.n}</div>
              <div className="text-3xl mb-3">{step.icon}</div>
              <div className="font-orbitron font-bold text-sm text-white mb-2">{step.title}</div>
              <div className="text-gray-500 text-sm leading-relaxed">{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Game Engines ──────────────────────────────────────────────── */}
      <section className="px-6 py-16" style={{ background: "#05071a" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="font-orbitron font-black text-center text-white text-2xl tracking-widest mb-2">
            3 GAME ENGINES
          </h2>
          <p className="text-center text-gray-500 text-sm mb-12">
            One prompt. Three ways to play.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-16">
            {ENGINES.map(e => (
              <div
                key={e.id}
                className="flex flex-col rounded-xl p-5"
                style={{
                  background: "#070d20",
                  border: `1px solid ${e.color}${e.soon ? "22" : "33"}`,
                  boxShadow: e.soon ? "none" : `0 0 20px ${e.color}11`,
                  opacity: e.soon ? 0.55 : 1,
                }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{e.emoji}</span>
                  <span className="font-orbitron font-black text-sm tracking-widest" style={{ color: e.color }}>
                    {e.label}
                  </span>
                  {e.soon && (
                    <span className="ml-auto text-[9px] font-orbitron tracking-widest text-gray-600">SOON</span>
                  )}
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{e.desc}</p>
              </div>
            ))}
          </div>

          {/* ── Live Demo Games ─────────────────────────────────────────── */}
          <h3 className="font-orbitron font-black text-center text-white text-lg tracking-widest mb-2">
            PLAY NOW
          </h3>
          <p className="text-center text-gray-600 text-xs mb-8">
            Real games forged by players — sign in to play
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Strategy demos */}
            <div>
              <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: "#4488ff" }}>
                🎮 GAMES & PUZZLES
              </div>
              <div className="space-y-2">
                {demos?.sandbox?.length ? demos.sandbox.map(s => (
                  <a
                    key={s.id}
                    href={`/play/${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition hover:opacity-80"
                    style={{ background: "#4488ff11", border: "1px solid #4488ff33" }}>
                    <span className="text-gray-600 text-xs font-orbitron">▶</span>
                    <span className="text-sm text-gray-300 truncate">{s.title}</span>
                  </a>
                )) : (
                  <div className="px-4 py-3 rounded-lg text-xs text-gray-600 font-orbitron tracking-widest"
                    style={{ border: "1px solid #1e2a4a" }}>
                    Loading...
                  </div>
                )}
              </div>
            </div>

            {/* WW2 Tactical demos */}
            <div>
              <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: "#f97316" }}>
                ⚔️ WW2 TACTICAL
              </div>
              <div className="space-y-2">
                {demos?.tactical?.length ? demos.tactical.map(s => (
                  <a
                    key={s.id}
                    href={`/play/${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition hover:opacity-80"
                    style={{ background: "#f9731611", border: "1px solid #f9731633" }}>
                    <span className="text-gray-600 text-xs font-orbitron">▶</span>
                    <span className="text-sm text-gray-300 truncate">{s.title}</span>
                  </a>
                )) : (
                  <div className="px-4 py-3 rounded-lg text-xs text-gray-600 font-orbitron tracking-widest"
                    style={{ border: "1px solid #1e2a4a" }}>
                    Loading...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section
        className="flex flex-col items-center justify-center text-center px-6 py-20 border-t"
        style={{ borderColor: "#1e2a4a", background: "#070d20" }}>
        <h2 className="font-orbitron font-black text-white text-2xl tracking-widest mb-3">
          READY TO FORGE?
        </h2>
        <p className="text-gray-500 text-sm mb-8 max-w-md">
          Sign up free and get 3 credits to start. No credit card required.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="px-8 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #4488ff33, #4488ff55)", border: "2px solid #4488ff", color: "#4488ff", boxShadow: "0 0 30px #4488ff33" }}>
          Get Started · Free
        </button>
      </section>

    </main>
  );
}
