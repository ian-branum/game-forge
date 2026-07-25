"use client";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const GAME_TYPES = [
  {
    id: "tactical",
    emoji: "⚔️",
    label: "Tactical",
    color: "#4488ff",
    desc: "Hex-based squad combat on procedurally generated battlefields. Command infantry, machine guns, and leaders across terrain that actually matters — woods give cover, roads speed movement, buildings anchor defenses.",
    demo: "/play/normandy-demo",
    demoLabel: "Normandy, 1944",
    available: true,
  },
  {
    id: "trivia",
    emoji: "🧠",
    label: "Trivia",
    color: "#a855f7",
    desc: "AI-generated quiz battles on any topic imaginable. From ancient Rome to quantum physics to 90s hip-hop — describe your subject and get a custom 10-question gauntlet with escalating difficulty.",
    demo: null,
    demoLabel: "Coming Soon",
    available: false,
  },
  {
    id: "word",
    emoji: "📝",
    label: "Word",
    color: "#22c55e",
    desc: "Crosswords, word searches, and anagram puzzles built around any theme you choose. The AI weaves your topic into every clue and answer, making each puzzle genuinely connected to the subject matter.",
    demo: null,
    demoLabel: "Coming Soon",
    available: false,
  },
  {
    id: "puzzle",
    emoji: "🧩",
    label: "Puzzle",
    color: "#f59e0b",
    desc: "Logic grids, nonograms, and deduction challenges with AI-crafted narratives. Each puzzle tells a story — solve the grid, unravel the mystery. Difficulty scales from gentle warmup to mind-bending.",
    demo: null,
    demoLabel: "Coming Soon",
    available: false,
  },
  {
    id: "card",
    emoji: "🃏",
    label: "Card",
    color: "#ef4444",
    desc: "Solitaire variants and trick-taking games with AI-generated rule twists. Describe a theme or mechanic and the AI builds a playable card game around it — complete with custom win conditions.",
    demo: null,
    demoLabel: "Coming Soon",
    available: false,
  },
  {
    id: "narrative",
    emoji: "📖",
    label: "Adventure",
    color: "#f97316",
    desc: "Branching text adventures and RPG scenarios with reactive AI storytelling. Every choice matters, every path diverges. Describe your world and your character — the AI does the rest.",
    demo: null,
    demoLabel: "Coming Soon",
    available: false,
  },
];

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="font-orbitron text-xs tracking-widest text-gray-500 animate-pulse">LOADING...</div>
      </div>
    );
  }

  return (
    <main className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24"
        style={{ background: "linear-gradient(180deg, #070d20 0%, #05071a 100%)", borderBottom: "1px solid #1e2a4a" }}>

        <div className="font-orbitron text-xs tracking-[0.4em] text-gray-500 mb-4 uppercase">
          AI · Games · On Demand
        </div>

        <h1 className="font-orbitron font-black tracking-widest text-white mb-4"
          style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 1.05 }}>
          GAME
          <span style={{ color: "#4488ff" }}> FORGE</span>
        </h1>

        <p className="text-gray-300 text-lg max-w-xl mb-2">
          Describe any scenario in plain English.
        </p>
        <p className="text-gray-500 text-base max-w-xl mb-10">
          AI generates a unique, playable game in seconds — tactical battles, trivia, puzzles, and more.
        </p>

        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-3 px-8 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #4488ff33, #4488ff55)", border: "2px solid #4488ff", color: "#4488ff", boxShadow: "0 0 30px #4488ff33" }}>
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
            <path d="M43.6 20.2H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.8z" fill="#4488ff" opacity="0.7"/>
          </svg>
          Sign In to Start Forging
        </button>

        <p className="text-gray-600 text-xs mt-4">
          3 free games on signup · No credit card required
        </p>

        <a href="#how-it-works"
          className="mt-10 text-gray-600 hover:text-gray-400 text-xs font-orbitron tracking-widest transition flex flex-col items-center gap-2">
          SEE HOW IT WORKS
          <span className="animate-bounce">↓</span>
        </a>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section id="how-it-works"
        className="flex justify-center gap-0 py-12 px-6 border-b"
        style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full text-center">
          {[
            { n: "01", icon: "🖊️", title: "Describe It", body: "Type a scenario in plain English. A battle, a quiz topic, a puzzle theme — anything." },
            { n: "02", icon: "⚡", title: "AI Forges It", body: "Our AI designs the map, units, rules, and content in seconds. Every game is unique." },
            { n: "03", icon: "🎮", title: "Play It", body: "Jump straight in. Share the link with anyone — no account needed to play shared games." },
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

      {/* ── Game Types ───────────────────────────────────────────────────── */}
      <section className="px-6 py-16" style={{ background: "#05071a" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="font-orbitron font-black text-center text-white text-2xl tracking-widest mb-2">
            6 GAME ENGINES
          </h2>
          <p className="text-center text-gray-500 text-sm mb-12">
            One prompt. Six ways to play.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {GAME_TYPES.map(gt => (
              <div key={gt.id}
                className="flex flex-col rounded-xl p-5"
                style={{
                  background: "#070d20",
                  border: `1px solid ${gt.color}33`,
                  boxShadow: `0 0 20px ${gt.color}11`,
                }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{gt.emoji}</span>
                  <span className="font-orbitron font-black text-sm tracking-widest"
                    style={{ color: gt.color }}>
                    {gt.label}
                  </span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed flex-1 mb-4">
                  {gt.desc}
                </p>
                {gt.available ? (
                  <a href={gt.demo!}
                    className="text-center py-2 rounded-lg font-orbitron font-bold text-xs tracking-widest transition hover:scale-105"
                    style={{ background: `${gt.color}22`, border: `1px solid ${gt.color}66`, color: gt.color }}>
                    ▶ Try Demo · {gt.demoLabel}
                  </a>
                ) : (
                  <div className="text-center py-2 rounded-lg font-orbitron text-xs tracking-widest"
                    style={{ background: "#ffffff08", border: "1px solid #ffffff11", color: "#555" }}>
                    {gt.demoLabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 border-t"
        style={{ borderColor: "#1e2a4a", background: "#070d20" }}>
        <h2 className="font-orbitron font-black text-white text-2xl tracking-widest mb-3">
          READY TO FORGE?
        </h2>
        <p className="text-gray-500 text-sm mb-8 max-w-md">
          Sign up free and get 3 credits to start. No credit card required.
        </p>
        <button
          onClick={() => signIn("google")}
          className="px-8 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #4488ff33, #4488ff55)", border: "2px solid #4488ff", color: "#4488ff", boxShadow: "0 0 30px #4488ff33" }}>
          Sign In with Google · Free
        </button>
      </section>

    </main>
  );
}
