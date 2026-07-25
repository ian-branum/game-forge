"use client";
import { useState } from "react";
import type { LogicPuzzle } from "@/lib/generators/puzzle";

type CellState = "empty" | "yes" | "no";

export default function PuzzleGame({ scenario }: { scenario: LogicPuzzle }) {
  const N = 4;
  const [cat0vs1, setCat0vs1] = useState<CellState[][]>(Array.from({ length: N }, () => Array(N).fill("empty")));
  const [cat0vs2, setCat0vs2] = useState<CellState[][]>(Array.from({ length: N }, () => Array(N).fill("empty")));
  const [cat1vs2, setCat1vs2] = useState<CellState[][]>(Array.from({ length: N }, () => Array(N).fill("empty")));
  const [solved, setSolved] = useState(false);
  const [checked, setChecked] = useState(false);
  const [wrong, setWrong] = useState(false);

  const [a, b, c] = scenario.categories;

  const cycle = (state: CellState): CellState =>
    state === "empty" ? "yes" : state === "yes" ? "no" : "empty";

  const toggle = (
    grid: CellState[][], setGrid: React.Dispatch<React.SetStateAction<CellState[][]>>,
    r: number, col: number
  ) => {
    if (solved) return;
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][col] = cycle(next[r][col]);
      return next;
    });
    setChecked(false);
  };

  function checkSolution() {
    setChecked(true);
    // Check cat0vs2 matches the solution
    for (let r = 0; r < N; r++) {
      for (let col = 0; col < N; col++) {
        const expected = scenario.solution[r][col] === 1 ? "yes" : "no";
        if (cat0vs2[r][col] !== expected) { setWrong(true); return; }
      }
    }
    setSolved(true);
    setWrong(false);
  }

  function reset() {
    setCat0vs1(Array.from({ length: N }, () => Array(N).fill("empty")));
    setCat0vs2(Array.from({ length: N }, () => Array(N).fill("empty")));
    setCat1vs2(Array.from({ length: N }, () => Array(N).fill("empty")));
    setSolved(false); setChecked(false); setWrong(false);
  }

  const Cell = ({ state, onClick }: { state: CellState; onClick: () => void }) => (
    <button onClick={onClick}
      className="flex items-center justify-center rounded text-sm font-bold transition-all hover:scale-110"
      style={{
        width: 36, height: 36, flexShrink: 0,
        background: state === "yes" ? "#22c55e22" : state === "no" ? "#ef444422" : "#0a0f2e",
        border: `1px solid ${state === "yes" ? "#22c55e" : state === "no" ? "#ef4444" : "#1e2a4a"}`,
        color: state === "yes" ? "#22c55e" : state === "no" ? "#ef4444" : "#374151",
        cursor: solved ? "default" : "pointer",
      }}>
      {state === "yes" ? "✓" : state === "no" ? "✗" : ""}
    </button>
  );

  const GridBlock = ({
    rowLabels, colLabels, grid, setGrid, title,
  }: {
    rowLabels: string[]; colLabels: string[];
    grid: CellState[][]; setGrid: React.Dispatch<React.SetStateAction<CellState[][]>>;
    title: string;
  }) => (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e2a4a" }}>
      <div className="px-3 py-1.5 font-orbitron text-xs text-gray-600 text-center" style={{ background: "#060b1a" }}>{title}</div>
      <div style={{ background: "#070d20" }}>
        {/* Column headers */}
        <div className="flex" style={{ marginLeft: 80 }}>
          {colLabels.map((label, i) => (
            <div key={i} className="text-center font-orbitron text-xs text-gray-500 px-1 py-1.5"
              style={{ width: 36, fontSize: 9, lineHeight: "1.2" }}>
              {label}
            </div>
          ))}
        </div>
        {/* Rows */}
        {rowLabels.map((rowLabel, r) => (
          <div key={r} className="flex items-center gap-1 px-2 py-1">
            <div className="text-right font-orbitron text-xs text-gray-500 pr-2 truncate" style={{ width: 76, fontSize: 9 }}>
              {rowLabel}
            </div>
            {grid[r].map((cell, col) => (
              <Cell key={col} state={cell} onClick={() => toggle(grid, setGrid, r, col)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] px-4 py-6" style={{ background: "#05071a" }}>
      <div className="max-w-3xl mx-auto w-full">

        <div className="text-center mb-6">
          <div className="font-orbitron font-black text-xl text-white mb-1">{scenario.title}</div>
          <div className="text-gray-500 text-xs mb-1">{scenario.topic}</div>
          <div className="text-gray-400 text-sm italic">{scenario.intro}</div>
        </div>

        {solved && (
          <div className="text-center py-3 rounded-xl mb-6 font-orbitron font-black"
            style={{ background: "#22c55e22", border: "2px solid #22c55e", color: "#22c55e" }}>
            🏆 PUZZLE SOLVED!
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Clues */}
          <div className="rounded-xl p-4" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
            <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: "#f59e0b" }}>CLUES</div>
            <ol className="space-y-2">
              {scenario.clues.map((clue, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="font-orbitron text-xs flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>{i + 1}.</span>
                  <span>{clue.text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Main grid: cat0 vs cat2 */}
          <GridBlock
            title={`${scenario.categories[0][0].split(" ")[0]}… ↔ ${scenario.categories[2][0].split(" ")[0]}…`}
            rowLabels={a} colLabels={c}
            grid={cat0vs2} setGrid={setCat0vs2}
          />
        </div>

        {/* Helper grids */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <GridBlock title={`${a[0].split(" ")[0]}… ↔ ${b[0].split(" ")[0]}…`} rowLabels={a} colLabels={b} grid={cat0vs1} setGrid={setCat0vs1} />
          <GridBlock title={`${b[0].split(" ")[0]}… ↔ ${c[0].split(" ")[0]}…`} rowLabels={b} colLabels={c} grid={cat1vs2} setGrid={setCat1vs2} />
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={checkSolution} disabled={solved}
            className="px-8 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest disabled:opacity-40"
            style={{ background: "#f59e0b22", border: "2px solid #f59e0b66", color: "#f59e0b" }}>
            CHECK SOLUTION
          </button>
          <button onClick={reset}
            className="px-6 py-3 rounded-xl font-orbitron text-sm tracking-widest"
            style={{ background: "#1e2a4a22", border: "1px solid #1e2a4a", color: "#6b7280" }}>
            RESET
          </button>
        </div>

        {checked && !solved && wrong && (
          <p className="text-center text-red-400 text-sm mt-3">Not quite — check the main grid (top-right).</p>
        )}
      </div>
    </div>
  );
}
