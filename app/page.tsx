"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const CATEGORIES = [
  { id: "tactical",  label: "Tactical",   emoji: "⚔️",  desc: "Hex-based squad combat" },
  { id: "trivia",    label: "Trivia",      emoji: "🧠",  desc: "Quiz on any topic" },
  { id: "word",      label: "Word",        emoji: "📝",  desc: "Crosswords & word puzzles" },
  { id: "puzzle",    label: "Puzzle",      emoji: "🧩",  desc: "Logic & grid puzzles" },
  { id: "card",      label: "Card",        emoji: "🃏",  desc: "Solitaire & card games" },
  { id: "narrative", label: "Adventure",   emoji: "📖",  desc: "Text adventure & RPG" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CategoryId>("tactical");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!session) { signIn(); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Generation failed"); setLoading(false); return; }
      router.push(`/play/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
      <h1 className="font-orbitron text-5xl font-black tracking-widest text-white mb-3">
        GAME FORGE
      </h1>
      <p className="text-gray-400 text-lg max-w-xl mb-10">
        Describe any scenario. AI generates a unique game just for you.
      </p>

      {/* Category picker */}
      <div className="grid grid-cols-3 gap-3 mb-8 w-full max-w-xl">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex flex-col items-center p-3 rounded-lg border transition text-sm
              ${category === c.id
                ? "border-indigo-500 bg-indigo-900/40 text-white"
                : "border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-500"}`}
          >
            <span className="text-2xl mb-1">{c.emoji}</span>
            <span className="font-orbitron text-xs font-bold">{c.label}</span>
            <span className="text-xs text-gray-500 mt-0.5">{c.desc}</span>
          </button>
        ))}
      </div>

      {/* Prompt input */}
      <div className="w-full max-w-xl">
        <textarea
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none text-sm"
          rows={3}
          placeholder={
            category === "tactical"
              ? "e.g. US Marines assault a Japanese-held Pacific island, 1944..."
              : category === "trivia"
              ? "e.g. 10 questions about the Apollo moon missions..."
              : "Describe your game..."
          }
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleGenerate(); }}
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-orbitron text-sm tracking-widest transition"
        >
          {loading ? "GENERATING..." : session ? "FORGE GAME" : "SIGN IN TO FORGE"}
        </button>
        <p className="text-gray-600 text-xs mt-3">
          {session
            ? `${(session.user as { credits?: number }).credits ?? "?"} credits remaining`
            : "3 free games on signup · No credit card required"}
        </p>
      </div>

      {/* Demo link */}
      <div className="mt-12 border-t border-gray-800 pt-8 w-full max-w-xl">
        <p className="text-gray-500 text-sm mb-4">Try a demo scenario:</p>
        <a
          href="/play/normandy-demo"
          className="inline-block px-6 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-gray-400 hover:text-white text-sm font-orbitron tracking-widest transition"
        >
          ⚔️ NORMANDY DEMO
        </a>
      </div>
    </main>
  );
}
