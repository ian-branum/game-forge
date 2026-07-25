"use client";
import { useState } from "react";
import type { TriviaScenario } from "@/lib/generators/trivia";

export default function TriviaGame({ scenario }: { scenario: TriviaScenario }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const q = scenario.questions[current];
  const total = scenario.questions.length;

  function pick(i: number) {
    if (selected !== null) return;
    setSelected(i);
    const correct = i === q.answer;
    if (correct) setScore(s => s + 1);
    setAnswers(a => [...a, i]);
  }

  function next() {
    if (current + 1 >= total) { setDone(true); return; }
    setCurrent(c => c + 1);
    setSelected(null);
  }

  function restart() {
    setCurrent(0); setSelected(null); setScore(0); setDone(false); setAnswers([]);
  }

  const pct = Math.round((score / total) * 100);
  const grade = pct >= 90 ? "S" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F";
  const gradeColor = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  if (done) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-6 text-center" style={{ background: "#05071a" }}>
      <div className="max-w-md w-full rounded-xl p-8" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
        <div className="font-orbitron text-xs tracking-widest text-gray-500 mb-4">QUIZ COMPLETE</div>
        <div className="font-orbitron font-black text-7xl mb-2" style={{ color: gradeColor }}>{grade}</div>
        <div className="text-gray-400 mb-1">{score} / {total} correct</div>
        <div className="font-orbitron text-2xl font-black text-white mb-6">{pct}%</div>
        <div className="grid grid-cols-8 gap-1 mb-6">
          {scenario.questions.map((q2, i) => (
            <div key={i} className="h-2 rounded-full" style={{ background: answers[i] === q2.answer ? "#22c55e" : "#ef4444" }} />
          ))}
        </div>
        <button onClick={restart}
          className="w-full py-3 rounded-lg font-orbitron font-bold text-sm tracking-widest"
          style={{ background: "#a855f722", border: "1px solid #a855f766", color: "#a855f7" }}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] px-4 py-8" style={{ background: "#05071a" }}>
      <div className="max-w-xl mx-auto w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-orbitron font-black text-xl text-white mb-1">{scenario.title}</div>
          <div className="text-gray-500 text-xs">{scenario.topic}</div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1e2a4a" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${((current) / total) * 100}%`, background: "#a855f7" }} />
          </div>
          <span className="font-orbitron text-xs text-gray-500">{current + 1}/{total}</span>
          <span className="font-orbitron text-xs" style={{ color: "#22c55e" }}>⚡{score}</span>
        </div>

        {/* Question */}
        <div className="rounded-xl p-6 mb-4" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
          <div className="font-orbitron text-xs tracking-widest mb-3" style={{ color: "#a855f7" }}>
            Q{current + 1}
          </div>
          <p className="text-white text-base leading-relaxed">{q.q}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          {q.options.map((opt, i) => {
            let bg = "#070d20", border = "#1e2a4a", color = "#9ca3af";
            if (selected !== null) {
              if (i === q.answer) { bg = "#22c55e11"; border = "#22c55e"; color = "#22c55e"; }
              else if (i === selected && i !== q.answer) { bg = "#ef444411"; border = "#ef4444"; color = "#ef4444"; }
            } else if (selected === null) {
              border = "#2a3a5a"; color = "#d1d5db";
            }
            return (
              <button key={i} onClick={() => pick(i)}
                className="text-left px-4 py-3 rounded-xl text-sm transition-all"
                style={{ background: bg, border: `1px solid ${border}`, color, cursor: selected !== null ? "default" : "pointer" }}>
                <span className="font-orbitron text-xs mr-2" style={{ color: border }}>
                  {["A","B","C","D"][i]}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Explanation + Next */}
        {selected !== null && (
          <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#0a0f2e", border: "1px solid #1e2a4a" }}>
            <span className="font-bold" style={{ color: selected === q.answer ? "#22c55e" : "#ef4444" }}>
              {selected === q.answer ? "✓ Correct! " : "✗ Wrong. "}
            </span>
            <span className="text-gray-400">{q.explanation}</span>
          </div>
        )}

        {selected !== null && (
          <button onClick={next}
            className="w-full py-3 rounded-xl font-orbitron font-black text-sm tracking-widest transition hover:scale-[1.02]"
            style={{ background: "#a855f722", border: "2px solid #a855f766", color: "#a855f7" }}>
            {current + 1 >= total ? "SEE RESULTS" : "NEXT QUESTION →"}
          </button>
        )}
      </div>
    </div>
  );
}
