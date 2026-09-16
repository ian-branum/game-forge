"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { AbstractStrategyScenario } from "../schema";
import {
  initialPosition,
  applyMove,
  movesFrom,
  legalMoves,
  gameStatus,
  boardToFen,
  applyCoordMove,
  squareName,
  kingSquare,
  UNICODE,
} from "./chess-engine";
import type { Position, Pos, Move, Piece, Color, PieceType } from "./chess-engine";

const LIGHT_SQUARE = "#1a2a4a";
const DARK_SQUARE = "#0a1020";
const SELECTED = "#4488ff";
const VALID = "#22c55e";
const LAST_MOVE = "#ffd700";
const CHECK = "#ef4444";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function coord(move: Move): string {
  const base = squareName(move.from) + squareName(move.to);
  return move.promotion && move.promotion !== "Q" ? base + move.promotion.toLowerCase() : base;
}

// Count captured pieces by diffing against the starting material.
const START_COUNT: Record<PieceType, number> = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };

function capturedFor(board: Position["board"], color: Color): PieceType[] {
  const remaining: Record<PieceType, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
  for (const row of board)
    for (const sq of row)
      if (sq && sq.color === color) remaining[sq.type]++;
  const missing: PieceType[] = [];
  (Object.keys(START_COUNT) as PieceType[]).forEach(t => {
    for (let i = 0; i < START_COUNT[t] - remaining[t]; i++) missing.push(t);
  });
  return missing;
}

function PieceGlyph({ piece, size }: { piece: Piece; size: number }) {
  return (
    <span
      style={{
        fontSize: size,
        lineHeight: 1,
        color: piece.color === "white" ? "#f8fafc" : "#0b0b0b",
        textShadow: piece.color === "white"
          ? "0 0 4px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.8)"
          : "0 0 4px rgba(255,255,255,0.35), 0 1px 1px rgba(0,0,0,0.8)",
        userSelect: "none",
      }}
    >
      {UNICODE[piece.color][piece.type]}
    </span>
  );
}

function CapturedStrip({ pieces, label }: { pieces: PieceType[]; label: string }) {
  return (
    <div className="flex items-center gap-1 min-h-[24px] flex-wrap">
      <span className="font-orbitron text-[9px] tracking-widest text-gray-600 mr-1">{label}</span>
      {pieces.map((t, i) => (
        <span key={i} style={{ fontSize: 18, lineHeight: 1, color: "#94a3b8" }}>{UNICODE.black[t]}</span>
      ))}
    </div>
  );
}

export default function ChessGame({ scenario }: { scenario: AbstractStrategyScenario }) {
  const [position, setPosition] = useState<Position>(() => initialPosition());
  const [selected, setSelected] = useState<Pos | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Pos; to: Pos } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [aiDown, setAiDown] = useState<null | "resigned" | "error">(null);
  const aiInFlight = useRef(false);

  const status = gameStatus(position);
  const finished = status === "checkmate" || status === "stalemate";
  const checked = status === "check" || status === "checkmate";
  const turn = position.turn; // "white" = human, "black" = AI

  const selectedMoves = useMemo(
    () => (selected ? movesFrom(position, selected) : []),
    [position, selected],
  );
  const destMap = useMemo(() => {
    const m = new Map<string, Move>();
    for (const mv of selectedMoves) m.set(`${mv.to.r},${mv.to.c}`, mv);
    return m;
  }, [selectedMoves]);

  const checkKing = checked ? kingSquare(position.board, turn) : null;
  const capturedByWhite = capturedFor(position.board, "black"); // black pieces taken by the human
  const capturedByBlack = capturedFor(position.board, "white"); // white pieces taken by the AI

  const humanMove = useCallback((mv: Move) => {
    const next = applyMove(position, mv);
    setPosition(next);
    setLastMove({ from: mv.from, to: mv.to });
    setHistory(h => [...h, coord(mv)]);
    setSelected(null);
  }, [position]);

  const onSquareClick = useCallback((r: number, c: number) => {
    if (finished || thinking || turn !== "white" || aiDown === "resigned") return;
    if (selected) {
      const mv = destMap.get(`${r},${c}`);
      if (mv) { humanMove(mv); return; }
    }
    const sq = position.board[r][c];
    if (sq && sq.color === "white") setSelected({ r, c });
    else setSelected(null);
  }, [finished, thinking, turn, aiDown, selected, destMap, position, humanMove]);

  // AI turn — triggered whenever it becomes Black's move.
  useEffect(() => {
    if (turn !== "black" || finished || aiDown === "resigned") return;
    if (aiInFlight.current) return;
    aiInFlight.current = true;
    let cancelled = false;

    setThinking(true);
    (async () => {
      try {
        const fen = boardToFen(position);
        const res = await fetch("/api/abstract-strategy/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fen, history, aiPersonality: scenario.aiPersonality }),
        });
        const data = await res.json() as { move?: string | null; resigned?: boolean };
        if (cancelled) return;

        if (!data.move) { setAiDown("resigned"); setThinking(false); return; }

        const applied = applyCoordMove(position, data.move);
        if (!applied) { setAiDown("resigned"); setThinking(false); return; }

        setPosition(applied.position);
        setLastMove({ from: applied.move.from, to: applied.move.to });
        setHistory(h => [...h, coord(applied.move)]);
        setThinking(false);
      } catch {
        if (!cancelled) { setAiDown("error"); setThinking(false); }
      } finally {
        aiInFlight.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [turn, finished, aiDown, position, history, scenario.aiPersonality]);

  function restart() {
    setPosition(initialPosition());
    setSelected(null);
    setLastMove(null);
    setHistory([]);
    setThinking(false);
    setAiDown(null);
    aiInFlight.current = false;
  }

  // Only offer a fallback move list when the AI has forfeited.
  const anyLegal = aiDown === "resigned" ? legalMoves(position).slice(0, 6).map(coord) : [];

  let banner: { text: string; color: string } | null = null;
  if (status === "checkmate") {
    banner = turn === "black"
      ? { text: "🏆 CHECKMATE — YOU WIN!", color: "#22c55e" }
      : { text: "💀 CHECKMATE — AI WINS", color: CHECK };
  } else if (status === "stalemate") {
    banner = { text: "🤝 STALEMATE — DRAW", color: "#f59e0b" };
  } else if (aiDown === "resigned") {
    banner = { text: "🏆 AI RESIGNED — YOU WIN!", color: "#22c55e" };
  } else if (aiDown === "error") {
    banner = { text: "⚠️ AI UNAVAILABLE — try again later", color: "#f59e0b" };
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] items-center justify-center px-4 py-6" style={{ background: "#05071a" }}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="font-orbitron font-black text-2xl tracking-widest text-white mb-1">
            {(scenario.title || "CHESS").toUpperCase()}
          </div>
          <div className="text-gray-500 text-xs">
            You are ♔ White · AI is ♚ Black{scenario.aiPersonality ? ` · ${scenario.aiPersonality}` : ""}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 mb-3 rounded-xl px-5 py-3" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
          <div className="flex items-center gap-2 flex-1">
            <span style={{ fontSize: 20 }}>♔</span>
            {!finished && turn === "white" && !thinking && !aiDown && (
              <span className="font-orbitron text-xs" style={{ color: "#4488ff" }}>YOUR TURN</span>
            )}
            {finished && turn === "white" && (
              <span className="font-orbitron text-xs" style={{ color: CHECK }}>GAME OVER</span>
            )}
          </div>
          <div className="font-orbitron text-xs text-gray-600">VS</div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {(thinking || turn === "black") && !finished && !aiDown && (
              <span className="font-orbitron text-xs animate-pulse" style={{ color: "#f59e0b" }}>AI THINKING...</span>
            )}
            <span style={{ fontSize: 20 }}>♚</span>
          </div>
        </div>

        {/* Check indicator */}
        {checked && !finished && (
          <div className="text-center text-xs font-orbitron mb-3" style={{ color: CHECK }}>
            ⚠️ {turn === "white" ? "WHITE" : "BLACK"} IS IN CHECK
          </div>
        )}

        {/* Banner */}
        {banner && (
          <div className="text-center py-3 rounded-xl mb-3 font-orbitron font-black"
            style={{ background: `${banner.color}22`, border: `2px solid ${banner.color}`, color: banner.color }}>
            {banner.text}
          </div>
        )}

        {anyLegal.length > 0 && (
          <div className="text-center text-[11px] text-gray-600 mb-3">
            Suggested moves: {anyLegal.join(" · ")}
          </div>
        )}

        {/* AI captures (white pieces taken by AI) */}
        <div className="mb-2"><CapturedStrip pieces={capturedByBlack} label="AI CAPTURED" /></div>

        {/* Board */}
        <div className="rounded-xl overflow-hidden mb-2" style={{ border: "2px solid #1e2a4a" }}>
          {position.board.map((row, r) => (
            <div key={r} className="flex">
              {row.map((sq, c) => {
                const isLight = (r + c) % 2 === 0;
                const key = `${r},${c}`;
                const isSelected = !!selected && selected.r === r && selected.c === c;
                const isDest = destMap.has(key);
                const isCapture = isDest && !!sq;
                const isLast = !!lastMove &&
                  ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
                const isCheckKing = !!checkKing && checkKing.r === r && checkKing.c === c;

                let bg = isLight ? LIGHT_SQUARE : DARK_SQUARE;
                if (isLast) bg = "#5a4a0a";
                if (isSelected) bg = SELECTED;
                if (isCheckKing) bg = "#5a0a0a";

                return (
                  <div
                    key={c}
                    onClick={() => onSquareClick(r, c)}
                    className="flex items-center justify-center transition-all relative"
                    style={{
                      width: "12.5%",
                      aspectRatio: "1",
                      minHeight: 44,
                      background: bg,
                      border: isCheckKing ? `1px solid ${CHECK}` : "1px solid rgba(255,255,255,0.03)",
                      boxShadow: isCheckKing
                        ? `inset 0 0 14px ${CHECK}`
                        : isLast
                        ? `inset 0 0 10px ${LAST_MOVE}55`
                        : undefined,
                      cursor: sq && sq.color === "white" && turn === "white" && !finished ? "pointer" : "default",
                      position: "relative",
                    }}
                  >
                    {/* rank label on first file */}
                    {c === 0 && (
                      <span className="absolute font-orbitron" style={{ top: 1, left: 3, fontSize: 8, color: "#4b5a7a" }}>
                        {8 - r}
                      </span>
                    )}
                    {/* file label on last rank */}
                    {r === 7 && (
                      <span className="absolute font-orbitron" style={{ bottom: 1, right: 3, fontSize: 8, color: "#4b5a7a" }}>
                        {FILES[c]}
                      </span>
                    )}

                    {sq && <PieceGlyph piece={sq} size={36} />}

                    {isDest && !isCapture && (
                      <div style={{ position: "absolute", width: "28%", height: "28%", borderRadius: "50%", background: `${VALID}44`, border: `1px solid ${VALID}88` }} />
                    )}
                    {isDest && isCapture && (
                      <div style={{ position: "absolute", inset: 2, borderRadius: "50%", border: `3px solid ${VALID}aa` }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Human captures (black pieces taken by human) */}
        <div className="mb-4"><CapturedStrip pieces={capturedByWhite} label="YOU CAPTURED" /></div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          <button onClick={restart}
            className="px-6 py-2 rounded-lg font-orbitron text-sm tracking-widest transition hover:opacity-80"
            style={{ background: "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e" }}>
            NEW GAME
          </button>
        </div>

        <div className="text-center mt-4 text-gray-700 text-xs">
          Click a piece to see legal moves · Green dots show where it can go · AI opponent is DeepSeek
        </div>
      </div>
    </div>
  );
}
