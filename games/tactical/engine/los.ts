import type { GameMap, Pos } from "./types";

// ─── Hex coordinate conversions (odd-r offset, pointy-top) ──────────────────
// Odd rows are shifted RIGHT by half a hex width.

function offsetToCube(row: number, col: number): [number, number, number] {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return [x, y, z];
}

function cubeToOffset(x: number, z: number): Pos {
  const col = x + (z - (z & 1)) / 2;
  return { row: z, col };
}

function cubeRound(fx: number, fy: number, fz: number): [number, number, number] {
  let rx = Math.round(fx);
  let ry = Math.round(fy);
  let rz = Math.round(fz);
  const dx = Math.abs(rx - fx);
  const dy = Math.abs(ry - fy);
  const dz = Math.abs(rz - fz);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, ry, rz];
}

/**
 * Returns all intermediate hexes between from and to (excluding endpoints).
 * Uses cube-coordinate lerp + round — the standard hex line algorithm.
 */
export function hexLine(from: Pos, to: Pos): Pos[] {
  const [x1, y1, z1] = offsetToCube(from.row, from.col);
  const [x2, y2, z2] = offsetToCube(to.row, to.col);
  const N = Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
  if (N === 0) return [];
  const points: Pos[] = [];
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const [rx, , rz] = cubeRound(
      x1 + (x2 - x1) * t,
      y1 + (y2 - y1) * t,
      z1 + (z2 - z1) * t,
    );
    points.push(cubeToOffset(rx, rz));
  }
  return points;
}

/**
 * LOS check using hex line drawing.
 * Same terrain rules as before, applied to intermediate hexes only.
 */
export function hasLOS(map: GameMap, from: Pos, to: Pos): boolean {
  if (from.row === to.row && from.col === to.col) return true;
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const intermediate = hexLine(from, to);

  let woodCount = 0;
  let wheatCount = 0;

  for (const pos of intermediate) {
    if (pos.row < 0 || pos.row >= rows || pos.col < 0 || pos.col >= cols) return false;
    const terrain = map[pos.row][pos.col].terrain;

    if (terrain === "building") return false;

    if (terrain === "woods") {
      woodCount++;
      if (woodCount > 2) return false;
    } else {
      woodCount = 0;
    }

    if (terrain === "wheatfield") {
      wheatCount++;
      if (wheatCount > 3) return false;
    } else {
      wheatCount = 0;
    }
  }

  return true;
}
