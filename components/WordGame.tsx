"use client";
import { useState, useCallback } from "react";
import type { WordPuzzle } from "@/lib/generators/word";

export default function WordGame({ scenario }: { scenario: WordPuzzle }) {
  const ROWS = scenario.grid.length;
  const COLS = scenario.grid[0]?.length ?? 12;

  const [found, setFound] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState<{ r: number; c: number }[]>([]);
  const [mouseDown, setMouseDown] = useState(false);
  const [flash, setFlash] = useState<string | null>(null); // "found" | "wrong"
  const [done, setDone] = useState(false);

  const foundCells = new Set<string>();
  for (const word of found) {
    // Re-locate found words in grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Horizontal
        if (c + word.length <= COLS) {
          const slice = scenario.grid[r].slice(c, c + word.length).join("");
          if (slice === word) for (let i = 0; i < word.length; i++) foundCells.add(`${r},${c + i}`);
        }
        // Vertical
        if (r + word.length <= ROWS) {
          const slice = Array.from({ length: word.length }, (_, i) => scenario.grid[r + i]?.[c] ?? "").join("");
          if (slice === word) for (let i = 0; i < word.length; i++) foundCells.add(`${r + i},${c}`);
        }
      }
    }
  }

  const selSet = new Set(selecting.map(p => `${p.r},${p.c}`));

  const startSelect = useCallback((r: number, c: number) => {
    setMouseDown(true);
    setSelecting([{ r, c }]);
  }, []);

  const extendSelect = useCallback((r: number, c: number) => {
    if (!mouseDown) return;
    setSelecting(prev => {
      if (!prev.length) return [{ r, c }];
      const start = prev[0];
      // Allow only horizontal or vertical
      if (r === start.r) {
        const minC = Math.min(start.c, c), maxC = Math.max(start.c, c);
        return Array.from({ length: maxC - minC + 1 }, (_, i) => ({ r, c: minC + i }));
      } else if (c === start.c) {
        const minR = Math.min(start.r, r), maxR = Math.max(start.r, r);
        return Array.from({ length: maxR - minR + 1 }, (_, i) => ({ r: minR + i, c }));
      }
      return prev;
    });
  }, [mouseDown]);

  const endSelect = useCallback(() => {
    setMouseDown(false);
    if (!selecting.length) return;
    const word = selecting.map(p => scenario.grid[p.r]?.[p.c] ?? "").join("");
    if (scenario.words.includes(word) && !found.has(word)) {
      setFound(prev => {
        const next = new Set(prev);
        next.add(word);
        if (next.size === scenario.words.length) setDone(true);
        return next;
      });
      setFlash("found");
      setTimeout(() => setFlash(null), 600);
    } else if (word.length > 1) {
      setFlash("wrong");
      setTimeout(() => setFlash(null), 400);
    }
    setSelecting([]);
  }, [selecting, found, scenario]);

  const COLORS = ["#4488ff","#22c55e","#f59e0b","#a855f7","#ef4444","#f97316","#06b6d4","#ec4899","#84cc16","#8b5cf6"];

  const wordColor = (word: string) => {
    const idx = scenario.words.indexOf(word);
    return COLORS[idx % COLORS.length];
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] px-4 py-6" style={{ background: "#05071a" }}>
      <div className="max-w-2xl mx-auto w-full">

        <div className="text-center mb-6">
          <div className="font-orbitron font-black text-xl text-white mb-1">{scenario.title}</div>
          <div className="text-gray-500 text-xs mb-1">{scenario.topic}</div>
          <div className="font-orbitron text-xs" style={{ color: "#22c55e" }}>
            {found.size}/{scenario.words.length} found
          </div>
        </div>

        {done && (
          <div className="text-center py-4 rounded-xl mb-6 font-orbitron font-black text-lg"
            style={{ background: "#22c55e22", border: "2px solid #22c55e", color: "#22c55e" }}>
            🎉 ALL WORDS FOUND!
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Grid */}
          <div className="flex-1">
            <div
              className="select-none rounded-xl overflow-hidden"
              style={{ background: "#070d20", border: `2px solid ${flash === "found" ? "#22c55e" : flash === "wrong" ? "#ef4444" : "#1e2a4a"}`, transition: "border-color 0.2s" }}
              onMouseLeave={endSelect}
            >
              {scenario.grid.map((row, r) => (
                <div key={r} className="flex">
                  {(Array.isArray(row) ? row : (row as string).split("")).map((cell: string, c: number) => {
                    const key = `${r},${c}`;
                    const isSel = selSet.has(key);
                    const isFound = foundCells.has(key);

                    // Find which word owns this cell for color
                    let cellColor = "#4488ff";
                    for (const w of found) {
                      for (let rr = 0; rr < ROWS; rr++) {
                        for (let cc = 0; cc < COLS; cc++) {
                          if (cc + w.length <= COLS) {
                            const slice = scenario.grid[rr].slice(cc, cc + w.length);
                            const sliceStr = typeof slice === "string" ? slice : slice.join("");
                            if (sliceStr === w && rr === r && c >= cc && c < cc + w.length) cellColor = wordColor(w);
                          }
                          if (rr + w.length <= ROWS) {
                            const slice = Array.from({ length: w.length }, (_, i) => {
                              const row2 = scenario.grid[rr + i];
                              return typeof row2 === "string" ? row2[cc] : row2?.[cc];
                            }).join("");
                            if (slice === w && cc === c && r >= rr && r < rr + w.length) cellColor = wordColor(w);
                          }
                        }
                      }
                    }

                    return (
                      <div
                        key={c}
                        onMouseDown={() => startSelect(r, c)}
                        onMouseEnter={() => extendSelect(r, c)}
                        onMouseUp={endSelect}
                        className="flex items-center justify-center font-orbitron font-black text-xs cursor-pointer transition-all"
                        style={{
                          width: "calc(100% / 12)", aspectRatio: "1",
                          background: isFound ? `${cellColor}33` : isSel ? "#4488ff22" : "transparent",
                          color: isFound ? cellColor : isSel ? "#4488ff" : "#6b7280",
                          border: "1px solid #0d1530",
                        }}>
                        {cell}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Word list */}
          <div className="lg:w-48 flex-shrink-0">
            <div className="font-orbitron text-xs tracking-widest text-gray-600 mb-3">FIND THESE WORDS</div>
            <div className="space-y-2">
              {scenario.words.map((word, i) => {
                const isFound = found.has(word);
                const color = wordColor(word);
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: isFound ? color : "#374151", marginTop: "4px" }} />
                    <div>
                      <div className="font-orbitron text-xs font-bold" style={{ color: isFound ? color : "#6b7280", textDecoration: isFound ? "line-through" : "none" }}>
                        {word}
                      </div>
                      <div className="text-gray-600 text-xs">{scenario.clues[i]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
