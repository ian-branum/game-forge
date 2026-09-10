import type {
  GameState,
  GameMap,
  Unit,
  Pos,
  Faction,
  Phase,
  ScenarioDefinition,
  ObjectiveState,
} from "./types";
import { hasLOS, hexLine } from "./los";

// ─── Hex distance (offset coords, odd-r) ────────────────────────────────────
function offsetToCube(row: number, col: number): [number, number, number] {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  return [x, -x - z, z];
}
function hexDist(a: Pos, b: Pos): number {
  const [ax, ay, az] = offsetToCube(a.row, a.col);
  const [bx, by, bz] = offsetToCube(b.row, b.col);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}


// ─── Helpers ────────────────────────────────────────────────────────────────

function terrainDefenseBonus(map: GameMap, pos: Pos): number {
  const tile = map[pos.row]?.[pos.col];
  if (!tile) return 0;
  switch (tile.terrain) {
    case "open":       return 0;
    case "road":       return 0;
    case "wall":       return 1;
    case "rubble":     return 1;
    case "wheatfield": return 1;
    case "woods":      return 2;
    case "building":   return 3;
    default:           return 0;
  }
}

function terrainMoveCost(terrain: string): number {
  switch (terrain) {
    case "road":       return 0.5;
    case "open":       return 1;
    case "wall":       return 1;
    case "wheatfield": return 1;
    case "woods":      return 2;
    case "building":   return 2;
    case "rubble":     return 2;
    default:           return 1;
  }
}

// kept for AI fallback convenience
function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function deepCloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function updateObjectives(state: GameState): GameState {
  const s = deepCloneState(state);
  for (const obj of s.objectives) {
    const unitOnTile = s.units.find(
      (u) =>
        u.pos.row === obj.pos.row &&
        u.pos.col === obj.pos.col &&
        u.status !== "eliminated"
    );
    if (unitOnTile) {
      obj.heldBy = unitOnTile.faction;
      s.map[obj.pos.row][obj.pos.col].objectiveHeldBy = unitOnTile.faction;
    }
    // If no unit is on the tile, keep whoever last held it
  }
  return s;
}

function hasLeaderBonus(state: GameState, unit: Unit, bonus: number): number {
  const leaders = state.units.filter(
    (u) =>
      u.type === "leader" &&
      u.faction === unit.faction &&
      u.status !== "eliminated" &&
      u.id !== unit.id
  );
  return leaders.some((l) => hexDist(l.pos, unit.pos) <= 2) ? bonus : 0;
}

// ─── Win Check ───────────────────────────────────────────────────────────────

function checkWinConditions(state: GameState): GameState {
  const s = deepCloneState(state);

  const alliedUnits = s.units.filter((u) => u.faction === "allied" && u.status !== "eliminated");
  const axisUnits   = s.units.filter((u) => u.faction === "axis"   && u.status !== "eliminated");

  if (alliedUnits.length === 0) {
    s.result = "axis_win";
    return s;
  }
  if (axisUnits.length === 0) {
    s.result = "allied_win";
    return s;
  }

  const alliedHeld = s.objectives.filter((o) => o.heldBy === "allied").length;
  if (alliedHeld >= s.scenario.alliedObjectivesNeeded) {
    s.result = "allied_win";
    return s;
  }

  if (s.turn > s.turnsTotal) {
    const axisHeld = s.objectives.filter((o) => o.heldBy === "axis").length;
    if (alliedHeld > axisHeld) {
      s.result = "allied_win";
    } else {
      // Tie or axis holds more → axis wins (defender wins ties)
      s.result = "axis_win";
    }
  }

  return s;
}

// ─── Init ────────────────────────────────────────────────────────────────────

export function initGame(scenario: ScenarioDefinition): GameState {
  const map: GameState["map"] = JSON.parse(JSON.stringify(scenario.map));
  const units: Unit[] = scenario.units.map((u) => ({
    ...u,
    status: "normal",
    mpUsed: 0,
    hasFired: false,
  }));

  const objectives: ObjectiveState[] = scenario.objectives.map((o) => {
    // Mark objective tiles on map
    map[o.pos.row][o.pos.col].objective = true;

    // Determine initial holder based on who's standing there
    const unitThere = units.find(
      (u) => u.pos.row === o.pos.row && u.pos.col === o.pos.col
    );
    const heldBy: Faction | null = unitThere ? unitThere.faction : "axis"; // spec says initially held by axis

    map[o.pos.row][o.pos.col].objectiveHeldBy = heldBy;

    return {
      pos: o.pos,
      label: o.label,
      heldBy,
    };
  });

  return {
    map,
    units,
    objectives,
    turn: 1,
    turnsTotal: scenario.turnsTotal,
    phase: "movement",
    activeUnit: null,
    faction: "allied",
    log: ["Mission start. Good luck, soldier."],
    result: "ongoing",
    scenario,
  };
}

// ─── Movement ────────────────────────────────────────────────────────────────

/**
 * Simple BFS to find minimum MP cost path and reachable tiles.
 */
export function getReachableTiles(state: GameState, unitId: string): Pos[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return [];
  if (unit.status === "eliminated") return [];

  const rows = state.map.length;
  const cols = state.map[0]?.length ?? 0;
  const remainingMP = unit.movement - unit.mpUsed;
  const suppressed = unit.status === "suppressed";

  // Enemies set for blocking
  const enemyPositions = new Set(
    state.units
      .filter((u) => u.faction !== unit.faction && u.status !== "eliminated")
      .map((u) => `${u.pos.row},${u.pos.col}`)
  );

  // BFS with cost tracking
  const visited = new Map<string, number>(); // key -> cost
  const queue: { pos: Pos; cost: number }[] = [{ pos: unit.pos, cost: 0 }];
  visited.set(`${unit.pos.row},${unit.pos.col}`, 0);

  const reachable: Pos[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { pos, cost } = current;

    // Add to reachable (excluding starting position)
    if (!(pos.row === unit.pos.row && pos.col === unit.pos.col)) {
      reachable.push(pos);
    }

    // Hex neighbors — 6 directions, offset depends on whether row is odd or even
    const isOdd = pos.row & 1;
    const hexNeighbors = isOdd
      ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
      : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];

    for (const [dr, dc] of hexNeighbors) {
      const nr = pos.row + dr;
      const nc = pos.col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const key = `${nr},${nc}`;
      if (enemyPositions.has(key)) continue;

      const tile = state.map[nr][nc];
      let moveCost = terrainMoveCost(tile.terrain);
      if (suppressed) moveCost += 1;

      const newCost = cost + moveCost;
      if (newCost <= remainingMP) {
        const existing = visited.get(key);
        if (existing === undefined || newCost < existing) {
          visited.set(key, newCost);
          queue.push({ pos: { row: nr, col: nc }, cost: newCost });
        }
      }
    }
  }

  return reachable;
}

export function moveUnit(state: GameState, unitId: string, to: Pos): GameState {
  if (state.phase !== "movement") {
    return { ...state, log: [`Cannot move — not movement phase`, ...state.log] };
  }

  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return state;

  if (unit.faction !== state.faction) {
    return { ...state, log: [`Cannot move enemy unit`, ...state.log] };
  }

  if (unit.status === "eliminated") {
    return { ...state, log: [`${unit.name} is eliminated`, ...state.log] };
  }

  const rows = state.map.length;
  const cols = state.map[0]?.length ?? 0;

  if (to.row < 0 || to.row >= rows || to.col < 0 || to.col >= cols) {
    return { ...state, log: [`Out of bounds`, ...state.log] };
  }

  // Check for enemy on destination
  const enemyThere = state.units.find(
    (u) =>
      u.faction !== unit.faction &&
      u.status !== "eliminated" &&
      u.pos.row === to.row &&
      u.pos.col === to.col
  );
  if (enemyThere) {
    return { ...state, log: [`${unit.name} cannot move to enemy-occupied tile`, ...state.log] };
  }

  // Check broken unit flee logic
  if (unit.status === "broken") {
    // Broken units can only flee toward own edge (row 11 for allied, row 0 for axis)
    const ownEdgeRow = unit.faction === "allied" ? rows - 1 : 0;
    const currentDist = Math.abs(unit.pos.row - ownEdgeRow);
    const newDist = Math.abs(to.row - ownEdgeRow);
    if (newDist > currentDist) {
      return { ...state, log: [`${unit.name} is broken and can only flee toward own edge`, ...state.log] };
    }
  }

  // Compute path cost via Chebyshev (simplified: direct step cost)
  // Use BFS to find actual cost
  const reachable = getReachableTiles(state, unitId);
  const canReach = reachable.some((p) => p.row === to.row && p.col === to.col);
  if (!canReach) {
    return { ...state, log: [`${unit.name} cannot reach that tile`, ...state.log] };
  }

  // Compute MP cost via hex line
  const pathTiles = [...hexLine(unit.pos, to), to];
  let mpCost = 0;
  for (const step of pathTiles) {
    if (step.row >= 0 && step.row < rows && step.col >= 0 && step.col < cols) {
      let cost = terrainMoveCost(state.map[step.row][step.col].terrain);
      if (unit.status === "suppressed") cost += 1;
      mpCost += cost;
    }
  }

  const s = deepCloneState(state);
  const u = s.units.find((u) => u.id === unitId)!;
  u.pos = { ...to };
  u.mpUsed += mpCost;

  const logEntry = `${u.name} moves to (${to.row},${to.col})`;

  const withLog: GameState = { ...s, log: [logEntry, ...s.log], activeUnit: unitId };
  let updated = updateObjectives(withLog);
  return updated;
}

// ─── Combat ──────────────────────────────────────────────────────────────────

export function getAttackableTargets(state: GameState, attackerId: string): Unit[] {
  const attacker = state.units.find((u) => u.id === attackerId);
  if (!attacker) return [];
  if (attacker.hasFired) return [];
  if (attacker.status === "eliminated") return [];

  return state.units.filter((u) => {
    if (u.faction === attacker.faction) return false;
    if (u.status === "eliminated") return false;
    const dist = hexDist(attacker.pos, u.pos);
    if (dist > attacker.range) return false;
    return hasLOS(state.map, attacker.pos, u.pos);
  });
}

export function fireUnit(state: GameState, attackerId: string, targetId: string): GameState {
  if (state.phase !== "combat") {
    return { ...state, log: [`Cannot fire — not combat phase`, ...state.log] };
  }

  const attacker = state.units.find((u) => u.id === attackerId);
  const target   = state.units.find((u) => u.id === targetId);
  if (!attacker || !target) return state;

  if (attacker.faction !== state.faction) {
    return { ...state, log: [`Cannot fire with enemy unit`, ...state.log] };
  }

  if (attacker.hasFired) {
    return { ...state, log: [`${attacker.name} has already fired`, ...state.log] };
  }

  if (attacker.status === "eliminated") {
    return { ...state, log: [`${attacker.name} is eliminated`, ...state.log] };
  }

  if (target.status === "eliminated") {
    return { ...state, log: [`${target.name} is already eliminated`, ...state.log] };
  }

  const dist = hexDist(attacker.pos, target.pos);
  if (dist > attacker.range) {
    return { ...state, log: [`${target.name} is out of range`, ...state.log] };
  }

  if (!hasLOS(state.map, attacker.pos, target.pos)) {
    return { ...state, log: [`No line of sight to ${target.name}`, ...state.log] };
  }

  const s = deepCloneState(state);
  const att = s.units.find((u) => u.id === attackerId)!;
  const tgt = s.units.find((u) => u.id === targetId)!;

  // Leader bonus
  const leaderBonus = hasLeaderBonus(s, att, 1);

  const roll = Math.random() * 10 + att.attack + leaderBonus;
  const defenseValue =
    tgt.defense +
    terrainDefenseBonus(s.map, tgt.pos) +
    (tgt.status === "suppressed" ? -1 : 0);

  att.hasFired = true;

  let result: string;
  if (roll > defenseValue + 4) {
    tgt.status = "eliminated";
    result = "ELIMINATED";
  } else if (roll > defenseValue + 2) {
    tgt.status = "broken";
    tgt.morale = Math.min(tgt.morale, 2);
    result = "BROKEN";
  } else if (roll > defenseValue) {
    tgt.status = "suppressed";
    result = "SUPPRESSED";
  } else {
    result = "MISS";
  }

  const logEntry = `${att.name} fires at ${tgt.name} → ${result}`;
  return { ...s, log: [logEntry, ...s.log] };
}

// ─── Rally ───────────────────────────────────────────────────────────────────

export function rallyUnit(state: GameState, unitId: string): GameState {
  if (state.phase !== "rally") {
    return { ...state, log: [`Cannot rally — not rally phase`, ...state.log] };
  }

  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return state;

  if (unit.faction !== state.faction) {
    return { ...state, log: [`Cannot rally enemy unit`, ...state.log] };
  }

  if (unit.status !== "broken" && unit.status !== "suppressed") {
    return { ...state, log: [`${unit.name} does not need to rally`, ...state.log] };
  }

  const s = deepCloneState(state);
  const u = s.units.find((u) => u.id === unitId)!;

  if (u.status === "suppressed") {
    u.status = "normal";
    return { ...s, log: [`${u.name} rallies to normal`, ...s.log] };
  }

  // Broken: roll needed
  const leaderBonus = hasLeaderBonus(s, u, 2);
  const roll = Math.random() * 10 + leaderBonus;
  const threshold = 10 - u.morale;

  if (roll > threshold) {
    u.status = "normal";
    u.morale = Math.min(u.morale + 1, 10);
    return { ...s, log: [`${u.name} rallies! Status restored.`, ...s.log] };
  } else {
    return { ...s, log: [`${u.name} fails to rally (rolled ${roll.toFixed(1)} vs ${threshold})`, ...s.log] };
  }
}

// ─── Phase Advancement ───────────────────────────────────────────────────────

export function advancePhase(state: GameState): GameState {
  const s = deepCloneState(state);

  const phaseOrder: Phase[] = ["movement", "combat", "rally"];
  const currentIndex = phaseOrder.indexOf(s.phase);

  if (currentIndex < 2) {
    // Still within the same faction's turn
    s.phase = phaseOrder[currentIndex + 1];
    return s;
  }

  // End of rally phase — switch faction or end turn
  // Reset all units of current faction
  for (const u of s.units) {
    if (u.faction === s.faction) {
      u.mpUsed = 0;
      u.hasFired = false;
    }
  }

  if (s.faction === "allied") {
    // Switch to axis
    s.faction = "axis";
    s.phase = "movement";
    s.activeUnit = null;
    return s;
  } else {
    // Axis done — end of full turn
    s.faction = "allied";
    s.phase = "movement";
    s.activeUnit = null;
    s.turn += 1;

    // Check win conditions
    return checkWinConditions(s);
  }
}

// ─── Axis AI ─────────────────────────────────────────────────────────────────

export function runAxisAI(state: GameState): GameState {
  let s = deepCloneState(state);

  const axisUnits = () => s.units.filter((u) => u.faction === "axis" && u.status !== "eliminated");

  // ── Movement Phase ──
  s.phase = "movement";
  s.faction = "axis";

  for (const unit of axisUnits()) {
    if (unit.status === "broken") {
      // Flee: pick the hex neighbor that maximizes distance from nearest allied
      const allied = s.units.filter((u) => u.faction === "allied" && u.status !== "eliminated");
      if (allied.length === 0) continue;

      const nearest = allied.reduce((a, b) =>
        hexDist(unit.pos, a.pos) < hexDist(unit.pos, b.pos) ? a : b
      );

      const isOdd2 = unit.pos.row & 1;
      const hexN2: [number,number][] = isOdd2
        ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
        : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];

      const occ2 = new Set(
        s.units.filter(u => u.status !== "eliminated" && u.id !== unit.id).map(u => `${u.pos.row},${u.pos.col}`)
      );

      let fleeTarget: Pos | null = null;
      let fleeBest = hexDist(unit.pos, nearest.pos);
      for (const [dr2, dc2] of hexN2) {
        const nr2 = unit.pos.row + dr2;
        const nc2 = unit.pos.col + dc2;
        if (nr2 < 0 || nr2 >= s.map.length || nc2 < 0 || nc2 >= (s.map[0]?.length ?? 0)) continue;
        if (occ2.has(`${nr2},${nc2}`)) continue;
        const d = hexDist({ row: nr2, col: nc2 }, nearest.pos);
        if (d > fleeBest) { fleeBest = d; fleeTarget = { row: nr2, col: nc2 }; }
      }

      if (fleeTarget) s = moveUnit(s, unit.id, fleeTarget);
    } else {
      // Move toward nearest uncontrolled (not held by axis) objective, or nearest allied
      const uncontrolled = s.objectives.filter((o) => o.heldBy !== "axis");
      let target: Pos;

      if (uncontrolled.length > 0) {
        const nearestObj = uncontrolled.reduce((a, b) =>
          hexDist(unit.pos, a.pos) < hexDist(unit.pos, b.pos) ? a : b
        );
        target = nearestObj.pos;
      } else {
        const allied = s.units.filter((u) => u.faction === "allied" && u.status !== "eliminated");
        if (allied.length === 0) continue;
        target = allied.reduce((a, b) =>
          hexDist(unit.pos, a.pos) < hexDist(unit.pos, b.pos) ? a : b
        ).pos;
      }

      // Move one hex step toward target using valid hex neighbors
      const isOdd = unit.pos.row & 1;
      const hexNeighbors: [number,number][] = isOdd
        ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
        : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];

      const occupied = new Set(
        s.units.filter(u => u.status !== "eliminated" && u.id !== unit.id).map(u => `${u.pos.row},${u.pos.col}`)
      );

      let bestNeighbor: Pos | null = null;
      let bestDist = hexDist(unit.pos, target);

      for (const [dr, dc] of hexNeighbors) {
        const nr = unit.pos.row + dr;
        const nc = unit.pos.col + dc;
        if (nr < 0 || nr >= s.map.length || nc < 0 || nc >= (s.map[0]?.length ?? 0)) continue;
        if (occupied.has(`${nr},${nc}`)) continue;
        const d = hexDist({ row: nr, col: nc }, target);
        if (d < bestDist) {
          bestDist = d;
          bestNeighbor = { row: nr, col: nc };
        }
      }

      if (bestNeighbor) {
        s = moveUnit(s, unit.id, bestNeighbor);
      }
    }
  }

  // ── Combat Phase ──
  s.phase = "combat";

  for (const unit of axisUnits()) {
    if (unit.hasFired) continue;

    // Find best target: allied in range + LOS, lowest defense+terrain
    const targets = getAttackableTargets(s, unit.id);
    if (targets.length === 0) continue;

    const best = targets.reduce((a, b) => {
      const defA = a.defense + terrainDefenseBonus(s.map, a.pos);
      const defB = b.defense + terrainDefenseBonus(s.map, b.pos);
      return defA <= defB ? a : b;
    });

    s = fireUnit(s, unit.id, best.id);
  }

  // ── Rally Phase ──
  s.phase = "rally";

  for (const unit of axisUnits()) {
    if (unit.status === "broken" || unit.status === "suppressed") {
      s = rallyUnit(s, unit.id);
    }
  }

  return s;
}
