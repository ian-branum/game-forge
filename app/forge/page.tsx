"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const CATEGORIES = [
  {
    id: "sandbox",
    label: "Games & Puzzles",
    emoji: "🎮",
    desc: "Any board, card, or puzzle game — chess, checkers, Go, solitaire, Sudoku, or invent your own with custom pieces and rules.",
    available: true,
  },
  {
    id: "tactical",
    label: "WW2 Tactical",
    emoji: "⚔️",
    desc: "Hex-based squad combat with line-of-sight, morale, and authentic WW2 scenarios. Describe the battle, AI sets the stage.",
    available: true,
  },
  {
    id: "narrative",
    label: "Adventure",
    emoji: "📖",
    desc: "Branching narrative adventures with an AI opponent that responds to your choices. Coming soon.",
    available: false,
  },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

export default function ForgePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CategoryId>("sandbox");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedCategory = CATEGORIES.find(c => c.id === category)!;

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!session) { signIn(); return; }
    setLoading(true);
    setStatusMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category }),
      });

      // Handle non-SSE early errors (auth, validation, insufficient credits, etc.)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError({
          message: `HTTP ${res.status}: ${data.error ?? "Unknown error"}`,
          detail: data.stack ?? JSON.stringify(data, null, 2),
        });
        setLoading(false);
        return;
      }

      if (!res.body) {
        setError({ message: "Network error: empty response body" });
        setLoading(false);
        return;
      }

      // Read the SSE stream — `status` events show progress, `done` is terminal.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const eventLine = block.match(/^event: (.+)$/m)?.[1];
          const dataLine = block.match(/^data: (.+)$/m)?.[1];
          if (!eventLine || !dataLine) continue;

          const payload = JSON.parse(dataLine);

          if (eventLine === "status") {
            setStatusMessage(payload.message);
          } else if (eventLine === "done") {
            if (payload.id) {
              router.push(`/play/${payload.id}`);
            } else {
              setError({ message: payload.error ?? "Unknown error", detail: payload.stack });
              setLoading(false);
            }
          }
        }
      }
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
          <h1 className="font-orbitron font-black text-3xl tracking-widest text-white mb-3">
            FORGE A GAME
          </h1>
          <p className="text-gray-500 text-sm">
            Describe your game. AI builds a unique game just for you.
          </p>
        </div>

        {/* Category picker */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => c.available && setCategory(c.id)}
              disabled={!c.available}
              className={`flex flex-col items-start p-4 rounded-xl border transition relative
                ${!c.available ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                ${category === c.id
                  ? "border-indigo-500 bg-indigo-900/40 text-white"
                  : c.available
                    ? "border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-500"
                    : "border-gray-800 bg-gray-900/10 text-gray-600"}`}>
              <span className="text-3xl mb-3">{c.emoji}</span>
              <span className="font-orbitron text-xs font-bold text-left mb-2 leading-snug">{c.label}</span>
              <span className="text-xs text-gray-500 text-left leading-relaxed">{c.desc}</span>
              {!c.available && (
                <span className="absolute top-2 right-2.5 text-[9px] font-orbitron text-gray-600 tracking-widest">SOON</span>
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
                : category === "sandbox"
                ? "e.g. Chess on a 10×10 board with artillery pieces. Or: Klondike Solitaire. Or: Go. Or: Sudoku. Describe any game or variant..."
                : selectedCategory.available
                ? "Describe your game..."
                : `${selectedCategory.label} — coming soon`
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
          {loading && statusMessage && (
            <p className="text-blue-400 text-sm text-center mt-3 font-orbitron animate-pulse">
              {statusMessage}
            </p>
          )}
          <p className="text-gray-600 text-xs mt-3 text-center">
            {session
              ? `⚡ ${(session.user as { credits?: number }).credits ?? "?"} credits remaining`
              : "Sign in to forge games"}
          </p>
        </div>


      </div>
    </main>
  );
}
