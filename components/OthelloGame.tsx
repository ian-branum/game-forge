"use client";
import { useState, useCallback, useEffect } from "react";

type Cell = "black" | "white" | null;
type Board = Cell[][];

const SIZE = 8;

function emptyBoard(): Board {
  const b: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  b[3][3] = "white"; b[3][4] = "black";
  b[4][3] = "black"; b[4][4] = "white";
  return b;
}

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const;

function opponent(p: Cell): Cell { return p === "black" ? "white" : "black"; }

function flips(board: Board, r: number, c: number, player: Cell): [number, number][] {
  if (board[r][c] !== null) return [];
  const result: [number, number][] = [];
  const opp = opponent(player);
  for (const [dr, dc] of DIRS) {
    const line: [number, number][] = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr; nc += dc;
    }
    if (line.length > 0 && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
      result.push(...line);
    }
  }
  return result;
}

function validMoves(board: Board, player: Cell): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (flips(board, r, c, player).length > 0) moves.push([r, c]);
  return moves;
}

function applyMove(board: Board, r: number, c: number, player: Cell): Board {
  const next = board.map(row => [...row]);
  next[r][c] = player;
  for (const [fr, fc] of flips(board, r, c, player)) next[fr][fc] = player;
  return next;
}

function countPieces(board: Board) {
  let black = 0, white = 0;
  for (const row of board) for (const cell of row) {
    if (cell === "black") black++;
    else if (cell === "white") white++;
  }
  return { black, white };
}

// AI: weighted position scoring
const WEIGHTS = [
  [100,-20, 10,  5,  5, 10,-20,100],
  [-20,-50, -2, -2, -2, -2,-50,-20],
  [ 10, -2,  5,  1,  1,  5, -2, 10],
  [  5, -2,  1,  0,  0,  1, -2,  5],
  [  5, -2,  1,  0,  0,  1, -2,  5],
  [ 10, -2,  5,  1,  1,  5, -2, 10],
  [-20,-50, -2, -2, -2, -2,-50,-20],
  [100,-20, 10,  5,  5, 10,-20,100],
];

function scoreBoard(board: Board, player: Cell): number {
  let score = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === player) score += WEIGHTS[r][c];
      else if (board[r][c] === opponent(player)) score -= WEIGHTS[r][c];
    }
  return score;
}

function minimax(board: Board, depth: number, player: Cell, aiPlayer: Cell, alpha: number, beta: number): number {
  const moves = validMoves(board, player);
  if (depth === 0 || moves.length === 0) return scoreBoard(board, aiPlayer);
  const isMax = player === aiPlayer;
  let best = isMax ? -Infinity : Infinity;
  for (const [r, c] of moves) {
    const next = applyMove(board, r, c, player);
    const score = minimax(next, depth - 1, opponent(player), aiPlayer, alpha, beta);
    if (isMax) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
    else        { best = Math.min(best, score); beta  = Math.min(beta, best); }
    if (beta <= alpha) break;
  }
  return best;
}

function aiMove(board: Board, aiPlayer: Cell): [number, number] | null {
  const moves = validMoves(board, aiPlayer);
  if (!moves.length) return null;
  let best = -Infinity, bestMove = moves[0];
  for (const [r, c] of moves) {
    const next = applyMove(board, r, c, aiPlayer);
    const score = minimax(next, 3, opponent(aiPlayer), aiPlayer, -Infinity, Infinity);
    if (score > best) { best = score; bestMove = [r, c]; }
  }
  return bestMove;
}

export default function OthelloGame() {
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [player, setPlayer] = useState<Cell>("black"); // human is black
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState<string>("");

  const humanMoves = validMoves(board, "black");
  const humanMoveSet = new Set(humanMoves.map(([r,c]) => `${r},${c}`));

  const checkGameOver = useCallback((b: Board, current: Cell): boolean => {
    if (validMoves(b, current).length === 0 && validMoves(b, opponent(current)).length === 0) return true;
    const { black, white } = countPieces(b);
    return black + white === SIZE * SIZE;
  }, []);

  const handleClick = useCallback((r: number, c: number) => {
    if (player !== "black" || thinking || gameOver) return;
    if (!humanMoveSet.has(`${r},${c}`)) return;

    const next = applyMove(board, r, c, "black");
    setBoard(next);
    setLastMove([r, c]);

    if (checkGameOver(next, "white")) { setGameOver(true); return; }

    // Check if white has moves
    if (validMoves(next, "white").length === 0) {
      setMessage("White has no moves — Black plays again");
      return; // player stays black
    }

    setPlayer("white");
    setThinking(true);
    setMessage("AI thinking...");
  }, [board, player, thinking, gameOver, humanMoveSet, checkGameOver]);

  // AI turn
  useEffect(() => {
    if (player !== "white" || !thinking || gameOver) return;
    const timer = setTimeout(() => {
      const move = aiMove(board, "white");
      if (!move) {
        setMessage("White has no moves — Black plays again");
        setPlayer("black");
        setThinking(false);
        return;
      }
      const [r, c] = move;
      const next = applyMove(board, r, c, "white");
      setBoard(next);
      setLastMove([r, c]);
      setThinking(false);
      setMessage("");

      if (checkGameOver(next, "black")) { setGameOver(true); setPlayer("white"); return; }
      if (validMoves(next, "black").length === 0) {
        setMessage("Black has no moves — White plays again");
        setPlayer("white");
        setThinking(true);
        return;
      }
      setPlayer("black");
    }, 300 + Math.random() * 400);
    return () => clearTimeout(timer);
  }, [player, thinking, board, gameOver, checkGameOver]);

  function restart() {
    setBoard(emptyBoard()); setPlayer("black"); setThinking(false);
    setLastMove(null); setGameOver(false); setMessage("");
  }

  const { black, white } = countPieces(board);
  const winner = gameOver ? (black > white ? "black" : white > black ? "white" : "draw") : null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] items-center justify-center px-4 py-6" style={{ background: "#05071a" }}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="font-orbitron font-black text-2xl tracking-widest text-white mb-1">OTHELLO</div>
          <div className="text-gray-500 text-xs">You are ⚫ Black · AI is ⚪ White</div>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-4 mb-4 rounded-xl px-5 py-3" style={{ background: "#070d20", border: "1px solid #1e2a4a" }}>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-5 h-5 rounded-full" style={{ background: "#1a1a1a", border: "2px solid #555" }} />
            <span className="font-orbitron font-black text-xl text-white">{black}</span>
            {!gameOver && player === "black" && !thinking && (
              <span className="font-orbitron text-xs ml-1" style={{ color: "#4488ff" }}>YOUR TURN</span>
            )}
          </div>
          <div className="font-orbitron text-xs text-gray-600">VS</div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {!gameOver && thinking && (
              <span className="font-orbitron text-xs animate-pulse" style={{ color: "#f59e0b" }}>THINKING...</span>
            )}
            <span className="font-orbitron font-black text-xl text-white">{white}</span>
            <div className="w-5 h-5 rounded-full" style={{ background: "#e2e8f0", border: "2px solid #aaa" }} />
          </div>
        </div>

        {/* Message */}
        {message && !gameOver && (
          <div className="text-center text-xs font-orbitron mb-3" style={{ color: "#f59e0b" }}>{message}</div>
        )}

        {/* Game over banner */}
        {gameOver && (
          <div className="text-center py-3 rounded-xl mb-4 font-orbitron font-black"
            style={{
              background: winner === "black" ? "#22c55e22" : winner === "white" ? "#ef444422" : "#f59e0b22",
              border: `2px solid ${winner === "black" ? "#22c55e" : winner === "white" ? "#ef4444" : "#f59e0b"}`,
              color: winner === "black" ? "#22c55e" : winner === "white" ? "#ef4444" : "#f59e0b",
            }}>
            {winner === "black" ? "🏆 YOU WIN!" : winner === "white" ? "💀 AI WINS" : "🤝 DRAW"}
            <span className="text-xs font-normal ml-3 opacity-70">{black}–{white}</span>
          </div>
        )}

        {/* Board */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: "2px solid #1e5a1e", background: "#0a3a0a" }}>
          {board.map((row, r) => (
            <div key={r} className="flex">
              {row.map((cell, c) => {
                const isValid = humanMoveSet.has(`${r},${c}`) && player === "black" && !thinking && !gameOver;
                const isLast = lastMove && lastMove[0] === r && lastMove[1] === c;
                return (
                  <div key={c} onClick={() => handleClick(r, c)}
                    className="flex items-center justify-center transition-all"
                    style={{
                      width: `${100/SIZE}%`, aspectRatio: "1",
                      background: isValid ? "#0d4a0d" : "#0a3a0a",
                      border: "1px solid #0d4a0d",
                      cursor: isValid ? "pointer" : "default",
                      position: "relative",
                    }}>
                    {cell ? (
                      <div style={{
                        width: "76%", height: "76%", borderRadius: "50%",
                        background: cell === "black" ? "radial-gradient(circle at 35% 35%, #555, #111)" : "radial-gradient(circle at 35% 35%, #fff, #bbb)",
                        boxShadow: isLast ? `0 0 8px ${cell === "black" ? "#4488ff" : "#ffd700"}` : "0 2px 4px rgba(0,0,0,0.5)",
                        border: isLast ? `2px solid ${cell === "black" ? "#4488ff" : "#ffd700"}` : "none",
                      }} />
                    ) : isValid ? (
                      <div style={{ width: "28%", height: "28%", borderRadius: "50%", background: "#22c55e33", border: "1px solid #22c55e55" }} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          <button onClick={restart}
            className="px-6 py-2 rounded-lg font-orbitron text-sm tracking-widest transition hover:opacity-80"
            style={{ background: "#22c55e22", border: "1px solid #22c55e44", color: "#22c55e" }}>
            NEW GAME
          </button>
        </div>

        <div className="text-center mt-4 text-gray-700 text-xs">
          Green dots show valid moves · Click to place · AI uses minimax with position weighting
        </div>
      </div>
    </div>
  );
}
