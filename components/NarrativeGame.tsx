"use client";
import { useState } from "react";
import type { NarrativeScenario } from "@/lib/generators/narrative";

export default function NarrativeGame({ scenario }: { scenario: NarrativeScenario }) {
  const [sceneId, setSceneId] = useState(0);
  const [history, setHistory] = useState<{ sceneId: number; choiceText: string; outcome: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const scene = scenario.scenes.find(s => s.id === sceneId) ?? scenario.scenes[0];

  function choose(choiceIdx: number) {
    const choice = scene.choices[choiceIdx];
    setHistory(h => [...h, { sceneId: scene.id, choiceText: choice.text, outcome: choice.outcome }]);
    setSceneId(choice.nextScene);
  }

  function restart() {
    setSceneId(0);
    setHistory([]);
    setShowHistory(false);
  }

  const endColors = { victory: "#22c55e", defeat: "#ef4444", neutral: "#f59e0b" };
  const endIcons  = { victory: "🏆", defeat: "💀", neutral: "🌅" };
  const endLabels = { victory: "VICTORY", defeat: "DEFEAT", neutral: "THE END" };

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] px-4 py-8" style={{ background: "#05071a" }}>
      <div className="max-w-xl mx-auto w-full">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-orbitron text-xs tracking-[0.3em] text-gray-600 mb-1">{scenario.genre.toUpperCase()}</div>
          <h1 className="font-orbitron font-black text-2xl text-white mb-2">{scenario.title}</h1>
          {sceneId === 0 && (
            <p className="text-gray-400 text-sm italic leading-relaxed">{scenario.opening}</p>
          )}
        </div>

        {/* Progress breadcrumb */}
        {history.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {history.map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ background: "#4488ff" }} />
              ))}
            </div>
            <button onClick={() => setShowHistory(h => !h)}
              className="font-orbitron text-xs text-gray-600 hover:text-gray-400 transition">
              {showHistory ? "HIDE LOG ▲" : "SHOW LOG ▼"}
            </button>
          </div>
        )}

        {/* History log */}
        {showHistory && history.length > 0 && (
          <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
            {history.map((h, i) => (
              <div key={i} className="text-xs">
                <div className="font-orbitron text-gray-600 mb-0.5">Step {i + 1}</div>
                <div className="text-gray-400">▶ {h.choiceText}</div>
                <div className="text-gray-600 italic mt-0.5">{h.outcome}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scene card */}
        {scene.isEnd ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "#070d20", border: `2px solid ${endColors[scene.endType ?? "neutral"]}` }}>
            <div className="text-5xl mb-4">{endIcons[scene.endType ?? "neutral"]}</div>
            <div className="font-orbitron font-black text-2xl mb-4" style={{ color: endColors[scene.endType ?? "neutral"] }}>
              {endLabels[scene.endType ?? "neutral"]}
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-6">{scene.text}</p>
            <div className="text-gray-600 text-xs mb-6">{history.length} choices made</div>
            <button onClick={restart}
              className="px-8 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest"
              style={{ background: "#f97316" + "22", border: `2px solid ${"#f97316"}66`, color: "#f97316" }}>
              PLAY AGAIN
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-xl p-6 mb-5" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
              <p className="text-gray-200 text-sm leading-relaxed">{scene.text}</p>
            </div>

            <div className="space-y-3">
              {scene.choices.map((choice, i) => (
                <button key={i} onClick={() => choose(i)}
                  className="w-full text-left rounded-xl p-4 transition-all hover:scale-[1.01] group"
                  style={{
                    background: "#070d20",
                    border: `1px solid ${choice.isGood ? "#22c55e33" : "#ef444422"}`,
                  }}>
                  <div className="flex items-start gap-3">
                    <span className="font-orbitron font-black text-sm flex-shrink-0 mt-0.5"
                      style={{ color: choice.isGood ? "#22c55e" : "#ef4444" }}>
                      {["A","B","C","D"][i]}
                    </span>
                    <div>
                      <div className="text-white text-sm font-medium group-hover:text-gray-100">{choice.text}</div>
                      <div className="text-gray-600 text-xs mt-1 italic">{choice.outcome}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
