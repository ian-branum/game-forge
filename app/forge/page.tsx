"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const CATEGORIES = [
  { id: "tactical",  label: "Tactical",   emoji: "⚔️",  desc: "Hex-based squad combat",       available: true },
  { id: "trivia",    label: "Trivia",      emoji: "🧠",  desc: "Quiz on any topic",             available: true },
  { id: "word",      label: "Word",        emoji: "📝",  desc: "Word search puzzles",           available: true },
  { id: "puzzle",    label: "Puzzle",      emoji: "🧩",  desc: "Logic grid puzzles",            available: true },
  { id: "card",      label: "Card",        emoji: "🃏",  desc: "Solitaire card games",          available: true },
  { id: "narrative", label: "Adventure",   emoji: "📖",  desc: "Branching text adventure",      available: true },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

export default function ForgePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CategoryId>("tactical");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);

  const selectedCategory = CATEGORIES.find(c => c.id === category)!;

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!session) { signIn(); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({
          message: `HTTP ${res.status}: ${data.error ?? "Unknown error"}`,
          detail: data.stack ?? JSON.stringify(data, null, 2),
        });
        setLoading(false);
        return;
      }
      router.push(`/play/${data.id}`);
    } catch (e) {
      setError({ message: `Network error: ${e instanceof Error ? e.message : String(e)}` });
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-6 py-12">

      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="font-orbitron text-xs tracking-[0.4em] text-gray-600 mb-3">NEW GAME</div>
          <h1 className="font-orbitron font-black text-3xl tracking-widest text-white mb-2">
            FORGE A GAME
          </h1>
          <p className="text-gray-500 text-sm mb-2">
            Describe any scenario. AI builds a unique game just for you.
          </p>
          <p className="text-gray-700 text-xs">
            💡 This generates <em>new</em> games from your prompt — not classic games like Chess or Othello.
            For those, try the <a href="/play/othello-demo" className="underline hover:text-gray-500">demo games</a>.
          </p>
        </div>

        {/* Category picker */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => c.available && setCategory(c.id)}
              disabled={!c.available}
              className={`flex flex-col items-center p-3 rounded-lg border transition text-sm relative
                ${!c.available ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                ${category === c.id
                  ? "border-indigo-500 bg-indigo-900/40 text-white"
                  : c.available ? "border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-500" : "border-gray-800 bg-gray-900/10 text-gray-600"}`}>
              <span className="text-2xl mb-1">{c.emoji}</span>
              <span className="font-orbitron text-xs font-bold">{c.label}</span>
              <span className="text-xs text-gray-500 mt-0.5">{c.desc}</span>
              {!c.available && (
                <span className="absolute top-1 right-1.5 text-[9px] font-orbitron text-gray-600">SOON</span>
              )}
            </button>
          ))}
        </div>

        {/* Prompt input */}
        <div>
          <textarea
            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none text-sm"
            rows={4}
            placeholder={
              category === "tactical"
                ? "e.g. US Marines assault a Japanese-held Pacific island, 1944. Dense jungle, beach landing, pillboxes on the high ground..."
                : selectedCategory.available
                ? "Describe your game..."
                : `${selectedCategory.label} games coming soon...`
            }
            value={prompt}
            disabled={!selectedCategory.available}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleGenerate(); }}
          />
          {error && (
            <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-3">
              <p className="text-red-400 text-sm font-bold mb-1">{error.message}</p>
              {error.detail && (
                <pre className="text-red-600 text-xs overflow-x-auto whitespace-pre-wrap break-all mt-1 max-h-48 overflow-y-auto">
                  {error.detail}
                </pre>
              )}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || !selectedCategory.available}
            className="mt-3 w-full py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: "linear-gradient(135deg, #4488ff22, #4488ff44)", border: "2px solid #4488ff66", color: "#4488ff" }}>
            {loading ? "FORGING..." : "FORGE GAME"}
          </button>
          <p className="text-gray-600 text-xs mt-3 text-center">
            {session
              ? `⚡ ${(session.user as { credits?: number }).credits ?? "?"} credits remaining · Tactical costs 3`
              : "Sign in to forge games"}
          </p>
        </div>

        {/* Demo link */}
        <div className="mt-10 pt-8 border-t text-center" style={{ borderColor: "#1e2a4a" }}>
          <p className="text-gray-600 text-xs mb-3 font-orbitron tracking-widest">OR TRY A DEMO</p>
          <a
            href="/play/normandy-demo"
            className="inline-block px-6 py-2 rounded-lg text-sm font-orbitron tracking-widest transition hover:opacity-80"
            style={{ background: "#4488ff11", border: "1px solid #4488ff33", color: "#4488ff88" }}>
            ⚔️ Normandy Demo
          </a>
        </div>
      </div>
    </main>
  );
}
