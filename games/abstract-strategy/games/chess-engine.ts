// Pure TypeScript chess engine — no external libraries.
// Board indexing: board[0][0] = a8 (top-left = black's back rank), board[7][7] = h1.

export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type Color = "white" | "black";

export interface Piece { type: PieceType; color: Color; }
export type Square = Piece | null;
export type Board = Square[][];

export interface Pos { r: number; c: number; }

export interface Move {
  from: Pos;
  to: Pos;
  piece: Piece;
  captured: Piece | null;
  promotion?: PieceType;
  castle?: "K" | "Q";
  enPassant?: boolean;
  double?: boolean;
}

export interface CastlingRights {
  whiteK: boolean;
  whiteQ: boolean;
  blackK: boolean;
  blackQ: boolean;
}

export interface Position {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  enPassant: Pos | null;
  halfmove: number;
  fullmove: number;
}

const KNIGHT_DELTAS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_DELTAS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
const BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];

export const UNICODE: Record<Color, Record<PieceType, string>> = {
  white: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  black: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function opponent(color: Color): Color {
  return color === "white" ? "black" : "white";
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(sq => (sq ? { ...sq } : null)));
}

export function squareName(p: Pos): string {
  return String.fromCharCode(97 + p.c) + String(8 - p.r);
}

export function parseSquare(s: string): Pos | null {
  if (!/^[a-h][1-8]$/.test(s)) return null;
  const c = s.charCodeAt(0) - 97;
  const r = 8 - Number(s[1]);
  return { r, c };
}

export function initialPosition(): Position {
  const board: Board = Array.from({ length: 8 }, () => Array<Square>(8).fill(null));
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: "black" };
    board[1][c] = { type: "P", color: "black" };
    board[6][c] = { type: "P", color: "white" };
    board[7][c] = { type: back[c], color: "white" };
  }
  return {
    board,
    turn: "white",
    castling: { whiteK: true, whiteQ: true, blackK: true, blackQ: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function kingSquare(board: Board, color: Color): Pos | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "K" && p.color === color) return { r, c };
    }
  return null;
}

function findKing(board: Board, color: Color): Pos | null {
  return kingSquare(board, color);
}

export function isSquareAttacked(board: Board, target: Pos, by: Color): boolean {
  // Pawns — white pawns attack "upward" (toward row 0).
  const pawnDir = by === "white" ? 1 : -1;
  for (const dc of [-1, 1]) {
    const r = target.r + pawnDir, c = target.c + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === by && p.type === "P") return true;
    }
  }
  // Knights
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const r = target.r + dr, c = target.c + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === by && p.type === "N") return true;
    }
  }
  // King
  for (const [dr, dc] of KING_DELTAS) {
    const r = target.r + dr, c = target.c + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === by && p.type === "K") return true;
    }
  }
  // Rook / Queen
  for (const [dr, dc] of ROOK_DIRS) {
    let r = target.r + dr, c = target.c + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === by && (p.type === "R" || p.type === "Q")) return true;
        break;
      }
      r += dr; c += dc;
    }
  }
  // Bishop / Queen
  for (const [dr, dc] of BISHOP_DIRS) {
    let r = target.r + dr, c = target.c + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === by && (p.type === "B" || p.type === "Q")) return true;
        break;
      }
      r += dr; c += dc;
    }
  }
  return false;
}

export function inCheck(pos: Position, color: Color): boolean {
  const king = findKing(pos.board, color);
  if (!king) return false;
  return isSquareAttacked(pos.board, king, opponent(color));
}

export function generatePseudoMoves(pos: Position, color: Color): Move[] {
  const moves: Move[] = [];
  const { board } = pos;

  const addSliding = (from: Pos, dirs: number[][], type: PieceType) => {
    const piece = { type, color };
    for (const [dr, dc] of dirs) {
      let r = from.r + dr, c = from.c + dc;
      while (inBounds(r, c)) {
        const target = board[r][c];
        if (!target) {
          moves.push({ from, to: { r, c }, piece, captured: null });
        } else {
          if (target.color !== color) moves.push({ from, to: { r, c }, piece, captured: target });
          break;
        }
        r += dr; c += dc;
      }
    }
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.color !== color) continue;
      const from: Pos = { r, c };
      const piece = sq;

      if (sq.type === "P") {
        const dir = color === "white" ? -1 : 1;
        const startRow = color === "white" ? 6 : 1;
        const promoRow = color === "white" ? 0 : 7;
        // Forward one
        if (inBounds(r + dir, c) && !board[r + dir][c]) {
          if (r + dir === promoRow) {
            moves.push({ from, to: { r: r + dir, c }, piece, captured: null, promotion: "Q" });
          } else {
            moves.push({ from, to: { r: r + dir, c }, piece, captured: null });
            // Forward two
            if (r === startRow && !board[r + 2 * dir][c]) {
              moves.push({ from, to: { r: r + 2 * dir, c }, piece, captured: null, double: true });
            }
          }
        }
        // Captures
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc];
          if (target && target.color !== color) {
            if (nr === promoRow) moves.push({ from, to: { r: nr, c: nc }, piece, captured: target, promotion: "Q" });
            else moves.push({ from, to: { r: nr, c: nc }, piece, captured: target });
          } else if (!target && pos.enPassant && pos.enPassant.r === nr && pos.enPassant.c === nc) {
            // En passant
            const capturedPawn = board[r][nc];
            if (capturedPawn && capturedPawn.type === "P" && capturedPawn.color !== color) {
              moves.push({ from, to: { r: nr, c: nc }, piece, captured: capturedPawn, enPassant: true });
            }
          }
        }
        continue;
      }

      if (sq.type === "N") {
        for (const [dr, dc] of KNIGHT_DELTAS) {
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ from, to: { r: nr, c: nc }, piece, captured: target ?? null });
          }
        }
        continue;
      }

      if (sq.type === "B") { addSliding(from, BISHOP_DIRS, "B"); continue; }
      if (sq.type === "R") { addSliding(from, ROOK_DIRS, "R"); continue; }
      if (sq.type === "Q") { addSliding(from, [...ROOK_DIRS, ...BISHOP_DIRS], "Q"); continue; }

      if (sq.type === "K") {
        for (const [dr, dc] of KING_DELTAS) {
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            moves.push({ from, to: { r: nr, c: nc }, piece, captured: target ?? null });
          }
        }
        // Castling
        const homeRow = color === "white" ? 7 : 0;
        if (r === homeRow && c === 4 && !isSquareAttacked(board, from, opponent(color))) {
          const canK = color === "white" ? pos.castling.whiteK : pos.castling.blackK;
          const canQ = color === "white" ? pos.castling.whiteQ : pos.castling.blackQ;
          const rookK = board[homeRow][7];
          const rookQ = board[homeRow][0];
          if (
            canK && rookK && rookK.type === "R" && rookK.color === color &&
            !board[homeRow][5] && !board[homeRow][6] &&
            !isSquareAttacked(board, { r: homeRow, c: 5 }, opponent(color)) &&
            !isSquareAttacked(board, { r: homeRow, c: 6 }, opponent(color))
          ) {
            moves.push({ from, to: { r: homeRow, c: 6 }, piece, captured: null, castle: "K" });
          }
          if (
            canQ && rookQ && rookQ.type === "R" && rookQ.color === color &&
            !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
            !isSquareAttacked(board, { r: homeRow, c: 3 }, opponent(color)) &&
            !isSquareAttacked(board, { r: homeRow, c: 2 }, opponent(color))
          ) {
            moves.push({ from, to: { r: homeRow, c: 2 }, piece, captured: null, castle: "Q" });
          }
        }
        continue;
      }
    }
  }
  return moves;
}

export function applyMove(pos: Position, move: Move): Position {
  const board = cloneBoard(pos.board);
  const { from, to } = move;
  const movingPiece = board[from.r][from.c];

  // En passant: remove the captured pawn (on the same rank as the moving pawn's origin).
  if (move.enPassant) {
    board[from.r][to.c] = null;
  }

  board[to.r][to.c] = movingPiece ? { ...movingPiece } : null;
  board[from.r][from.c] = null;

  // Promotion
  if (move.promotion && board[to.r][to.c]) {
    board[to.r][to.c] = { type: move.promotion, color: movingPiece!.color };
  }

  // Castling: move the rook too.
  if (move.castle === "K") {
    board[to.r][5] = board[to.r][7];
    board[to.r][7] = null;
  } else if (move.castle === "Q") {
    board[to.r][3] = board[to.r][0];
    board[to.r][0] = null;
  }

  // Castling rights
  const castling: CastlingRights = { ...pos.castling };
  const color = movingPiece!.color;
  if (movingPiece!.type === "K") {
    if (color === "white") { castling.whiteK = false; castling.whiteQ = false; }
    else { castling.blackK = false; castling.blackQ = false; }
  }
  // Rook moved off its home square
  if (movingPiece!.type === "R") {
    if (from.r === 7 && from.c === 0) castling.whiteQ = false;
    if (from.r === 7 && from.c === 7) castling.whiteK = false;
    if (from.r === 0 && from.c === 0) castling.blackQ = false;
    if (from.r === 0 && from.c === 7) castling.blackK = false;
  }
  // Rook captured on its home square
  if (move.captured && move.captured.type === "R") {
    if (to.r === 7 && to.c === 0) castling.whiteQ = false;
    if (to.r === 7 && to.c === 7) castling.whiteK = false;
    if (to.r === 0 && to.c === 0) castling.blackQ = false;
    if (to.r === 0 && to.c === 7) castling.blackK = false;
  }

  // En passant target for next move
  let enPassant: Pos | null = null;
  if (move.double && movingPiece!.type === "P") {
    enPassant = { r: (from.r + to.r) / 2, c: from.c };
  }

  const halfmove = movingPiece!.type === "P" || move.captured ? 0 : pos.halfmove + 1;
  const fullmove = pos.turn === "black" ? pos.fullmove + 1 : pos.fullmove;

  return { board, turn: opponent(pos.turn), castling, enPassant, halfmove, fullmove };
}

export function legalMoves(pos: Position, color?: Color): Move[] {
  const side = color ?? pos.turn;
  const pseudo = generatePseudoMoves(pos, side);
  const result: Move[] = [];
  for (const move of pseudo) {
    const next = applyMove(pos, move);
    if (!inCheck(next, side)) result.push(move);
  }
  return result;
}

export function movesFrom(pos: Position, from: Pos): Move[] {
  return legalMoves(pos).filter(m => m.from.r === from.r && m.from.c === from.c);
}

export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";

export function gameStatus(pos: Position): GameStatus {
  const moves = legalMoves(pos);
  const checked = inCheck(pos, pos.turn);
  if (moves.length === 0) return checked ? "checkmate" : "stalemate";
  return checked ? "check" : "playing";
}

/** Standard FEN (castling rights, en-passant target, clocks). */
export function boardToFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = "", empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r][c];
      if (!p) { empty++; continue; }
      if (empty) { s += empty; empty = 0; }
      const ch = p.type === "N" ? "n" : p.type.toLowerCase();
      s += p.color === "white" ? ch.toUpperCase() : ch;
    }
    if (empty) s += empty;
    rows.push(s);
  }
  const castling =
    (pos.castling.whiteK ? "K" : "") +
    (pos.castling.whiteQ ? "Q" : "") +
    (pos.castling.blackK ? "k" : "") +
    (pos.castling.blackQ ? "q" : "") || "-";
  const ep = pos.enPassant ? squareName(pos.enPassant) : "-";
  return `${rows.join("/")} ${pos.turn === "white" ? "w" : "b"} ${castling} ${ep} ${pos.halfmove} ${pos.fullmove}`;
}

/** Parse a FEN string into a Position (used server-side for move validation). */
export function fenToPosition(fen: string): Position {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board: Board = Array.from({ length: 8 }, () => Array<Square>(8).fill(null));
  const ranks = placement.split("/");
  for (let r = 0; r < 8 && r < ranks.length; r++) {
    let c = 0;
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) { c += Number(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? "white" : "black";
      const type = ch.toUpperCase() as PieceType;
      if (inBounds(r, c)) board[r][c] = { type, color };
      c++;
    }
  }
  return {
    board,
    turn: turn === "b" ? "black" : "white",
    castling: {
      whiteK: castling?.includes("K") ?? false,
      whiteQ: castling?.includes("Q") ?? false,
      blackK: castling?.includes("k") ?? false,
      blackQ: castling?.includes("q") ?? false,
    },
    enPassant: ep && ep !== "-" ? parseSquare(ep) : null,
    halfmove: Number(half ?? 0) || 0,
    fullmove: Number(full ?? 1) || 1,
  };
}

/** Parse a coordinate move like "e2e4", "e7e8q", "e2-e4" or "e2 e4". */
export function parseCoordMove(raw: string): { from: Pos; to: Pos; promotion?: PieceType } | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[\s\-x]/g, "");
  const m = cleaned.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?/);
  if (!m) return null;
  const from = parseSquare(m[1]);
  const to = parseSquare(m[2]);
  if (!from || !to) return null;
  const promotion = m[3] ? (m[3].toUpperCase() as PieceType) : undefined;
  return { from, to, promotion };
}

/** Resolve a from/to pair against the legal moves. Prefers queen promotion. */
export function findLegalMove(pos: Position, from: Pos, to: Pos, promotion?: PieceType): Move | null {
  const candidates = legalMoves(pos).filter(
    m => m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c,
  );
  if (candidates.length === 0) return null;
  if (promotion) {
    return candidates.find(m => m.promotion === promotion) ?? candidates[0];
  }
  return candidates.find(m => m.promotion === "Q") ?? candidates[0];
}

/** Apply a coordinate move string if legal; returns the new position or null. */
export function applyCoordMove(pos: Position, raw: string): { position: Position; move: Move } | null {
  const parsed = parseCoordMove(raw);
  if (!parsed) return null;
  const move = findLegalMove(pos, parsed.from, parsed.to, parsed.promotion);
  if (!move) return null;
  return { position: applyMove(pos, move), move };
}
