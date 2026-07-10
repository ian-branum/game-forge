"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState, Unit, Pos, Phase } from "@/lib/squad-leader/types";
import {
  initGame,
  moveUnit,
  fireUnit,
  rallyUnit,
  advancePhase,
  getReachableTiles,
  getAttackableTargets,
  runAxisAI,
} from "@/lib/squad-leader/engine";
import { normandyScenario } from "@/lib/squad-leader/scenarios/normandy";
import { playSquadFire, playLeaderFire, playMGFire } from "@/lib/squad-leader/sounds";
import { animateTracers } from "@/lib/squad-leader/tracers";

// ─── Hex geometry ─────────────────────────────────────────────────────────────
// Pointy-top hexes, odd-row offset layout
const HEX_SIZE = 26; // circumradius (center to corner)
const HEX_W    = Math.round(Math.sqrt(3) * HEX_SIZE); // flat width
const HEX_H    = HEX_SIZE * 2;                          // height
const ROW_H    = Math.round(HEX_H * 0.75);              // row-to-row distance

function hexCenter(row: number, col: number): [number, number] {
  const x = col * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0) + HEX_W / 2;
  const y = row * ROW_H + HEX_H / 2;
  return [x, y];
}

/** SVG polygon points for a pointy-top hex centred at (cx, cy) */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** Return the hex (row,col) that contains pixel (px, py) */
function pixelToHex(px: number, py: number, rows: number, cols: number): Pos | null {
  // Brute-force nearest-centre (fine for small maps)
  let best: Pos | null = null;
  let bestD = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [cx, cy] = hexCenter(r, c);
      const d = (px - cx) ** 2 + (py - cy) ** 2;
      if (d < bestD) { bestD = d; best = { row: r, col: c }; }
    }
  }
  return best;
}

// ─── Terrain visuals ──────────────────────────────────────────────────────────
const TERRAIN_FILL: Record<string, string> = {
  open:       "#b8a85c",
  road:       "#7a6540",
  woods:      "#2a5218",
  building:   "#7a5c10",
  rubble:     "#5a5a5a",
  wall:       "#8a7a5a",
  wheatfield: "#c89830",
};

const TERRAIN_STROKE: Record<string, string> = {
  open:       "#9a8a48",
  road:       "#5a4828",
  woods:      "#1a3a0c",
  building:   "#5a4008",
  rubble:     "#3a3a3a",
  wall:       "#6a5a3a",
  wheatfield: "#a07820",
};

const TERRAIN_LABEL: Record<string, string> = {
  open:       "Open Ground",
  road:       "Road",
  woods:      "Woods",
  building:   "Building",
  rubble:     "Rubble",
  wall:       "Stone Wall",
  wheatfield: "Wheatfield",
};

const TERRAIN_EFFECT: Record<string, string> = {
  open:       "No cover. Fast movement (1 MP).",
  road:       "No cover. Very fast movement (0.5 MP).",
  woods:      "+2 defense. Slow movement (2 MP). Blocks LOS beyond 2 hexes.",
  building:   "+3 defense. Slow movement (2 MP). Blocks LOS entirely.",
  rubble:     "+1 defense. Slow movement (2 MP).",
  wall:       "+1 defense. Normal movement (1 MP). Partial LOS block.",
  wheatfield: "+1 defense. Normal movement (1 MP). Blocks LOS beyond 3 hexes.",
};

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  normal:     "#22c55e",
  suppressed: "#f59e0b",
  broken:     "#ef4444",
  eliminated: "#6b7280",
};

// ─── Faction palette ──────────────────────────────────────────────────────────
// Allied = olive green, Axis = Wehrmacht gray
const FACTION_FILL: Record<string, string>   = { allied: "#4a5e2a", axis: "#6b7355" };
const FACTION_STROKE: Record<string, string> = { allied: "#a0b860", axis: "#c8ceb0" };

// ─── NATO symbology SVG renderers ────────────────────────────────────────────
// Each returns inner SVG elements (no <svg> wrapper); drawn inside a 36×26 viewBox

type NATOProps = { fill: string; stroke: string; opacity?: number };

function NATOInfantry({ fill, stroke, opacity = 1 }: NATOProps) {
  // Rectangle with X inside + two dots above (squad)
  return (
    <g opacity={opacity}>
      <rect x="2" y="7" width="32" height="18" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <line x1="2" y1="7" x2="34" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="34" y1="7" x2="2" y2="25" stroke={stroke} strokeWidth="1.5" />
      <circle cx="13" cy="3.5" r="2" fill={stroke} />
      <circle cx="23" cy="3.5" r="2" fill={stroke} />
    </g>
  );
}

function NATОМG({ fill, stroke, opacity = 1 }: NATOProps) {
  // Rectangle with X + "MG" text + single dot above (MG team)
  return (
    <g opacity={opacity}>
      <rect x="2" y="7" width="32" height="18" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <line x1="2" y1="7" x2="34" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="34" y1="7" x2="2" y2="25" stroke={stroke} strokeWidth="1.5" />
      <text x="18" y="20" textAnchor="middle" fontSize="7" fill={stroke} fontWeight="bold" fontFamily="monospace">MG</text>
      <circle cx="18" cy="3.5" r="2" fill={stroke} />
    </g>
  );
}

function NATOMortar({ fill, stroke, opacity = 1 }: NATOProps) {
  // Rectangle with X + "MTR" text
  return (
    <g opacity={opacity}>
      <rect x="2" y="7" width="32" height="18" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <line x1="2" y1="7" x2="34" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="34" y1="7" x2="2" y2="25" stroke={stroke} strokeWidth="1.5" />
      <text x="18" y="20" textAnchor="middle" fontSize="7" fill={stroke} fontWeight="bold" fontFamily="monospace">MTR</text>
    </g>
  );
}

function NATOLeader({ fill, stroke, label, opacity = 1 }: NATOProps & { label: string }) {
  // Plain rectangle + label (PLT, COY, SGT, 1SG etc.)
  return (
    <g opacity={opacity}>
      <rect x="2" y="4" width="32" height="20" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <text x="18" y="17" textAnchor="middle" fontSize="7.5" fill={stroke} fontWeight="bold" fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

// Pick the right NATO symbol from a unit
function NATOSymbol({ unit, opacity }: { unit: Unit; opacity?: number }) {
  const fill   = FACTION_FILL[unit.faction];
  const stroke = FACTION_STROKE[unit.faction];
  const op     = opacity ?? 1;

  if (unit.type === "leader") {
    // Derive label from name heuristics
    const n = unit.name.toLowerCase();
    const label = n.includes("plt") || n.includes("platoon") ? "PLT"
      : n.includes("coy") || n.includes("company") || n.includes("cdr") ? "COY"
      : n.includes("1sg") || n.includes("first sgt") ? "1SG"
      : n.includes("sgt") || n.includes("sergeant") || n.includes("feldwebel") ? "SGT"
      : n.includes("lt") || n.includes("lieutenant") || n.includes("leutnant") ? "LT"
      : "LDR";
    return <NATOLeader fill={fill} stroke={stroke} label={label} opacity={op} />;
  }
  if (unit.type === "mg") return <NATОМG fill={fill} stroke={stroke} opacity={op} />;
  if (unit.type === "mortar") return <NATOMortar fill={fill} stroke={stroke} opacity={op} />;
  // infantry (default)
  return <NATOInfantry fill={fill} stroke={stroke} opacity={op} />;
}

// ─── Terrain mini-icons (painted inside hex when no unit present) ──────────
function TerrainIcon({ terrain, cx, cy }: { terrain: string; cx: number; cy: number }) {
  if (terrain === "woods") {
    return (
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" opacity={0.55} style={{ userSelect: "none" }}>🌲</text>
    );
  }
  if (terrain === "building") {
    return (
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" opacity={0.6} style={{ userSelect: "none" }}>🏠</text>
    );
  }
  if (terrain === "wall") {
    return (
      <>
        <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="#6a5a3a" strokeWidth="3" strokeLinecap="round" opacity={0.7} />
        <line x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy + 4} stroke="#6a5a3a" strokeWidth="3" strokeLinecap="round" opacity={0.5} />
      </>
    );
  }
  if (terrain === "rubble") {
    return (
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" opacity={0.55} style={{ userSelect: "none" }}>💥</text>
    );
  }
  return null;
}

// ─── Objective marker ────────────────────────────────────────────────────────
function ObjectiveMarker({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={10} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray="4 2" opacity={0.9} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" style={{ userSelect: "none" }}>⭐</text>
    </>
  );
}

// ─── Tooltip state ───────────────────────────────────────────────────────────
interface TooltipState {
  x: number; y: number;
  terrain: string;
  unitName?: string;
  unitStatus?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SquadLeader() {
  const [gameState, setGameState]             = useState<GameState | null>(null);
  const [showBriefing, setShowBriefing]       = useState(true);
  const [reachableTiles, setReachableTiles]   = useState<Set<string>>(new Set());
  const [attackableTargets, setAttackableTargets] = useState<Set<string>>(new Set());
  const [axisActing, setAxisActing]           = useState(false);
  const [axisLog, setAxisLog]                 = useState<string[]>([]);
  const [tooltip, setTooltip]                 = useState<TooltipState | null>(null);
  const tooltipTimer                          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredObjLabel, setHoveredObjLabel] = useState<string | null>(null); // from map hex
  const [hoveredObjBar, setHoveredObjBar]     = useState<string | null>(null); // from objectives bar
  const audioCtx                              = useRef<AudioContext | null>(null);
  const tracerCanvas                          = useRef<HTMLCanvasElement | null>(null);

  const startGame = useCallback(() => {
    setGameState(initGame(normandyScenario));
    setShowBriefing(false);
  }, []);

  const restartGame = useCallback(() => {
    setGameState(initGame(normandyScenario));
    setReachableTiles(new Set());
    setAttackableTargets(new Set());
  }, []);

  useEffect(() => {
    if (!gameState || gameState.result !== "ongoing" || gameState.faction !== "allied") return;
    const { activeUnit, phase } = gameState;
    if (!activeUnit) { setReachableTiles(new Set()); setAttackableTargets(new Set()); return; }
    if (phase === "movement") {
      setReachableTiles(new Set(getReachableTiles(gameState, activeUnit).map(p => `${p.row},${p.col}`)));
      setAttackableTargets(new Set());
    } else if (phase === "combat") {
      setAttackableTargets(new Set(getAttackableTargets(gameState, activeUnit).map(u => u.id)));
      setReachableTiles(new Set());
    } else {
      setReachableTiles(new Set()); setAttackableTargets(new Set());
    }
  }, [gameState]);

  // ── Map interactions ──────────────────────────────────────────────────────

  const handleSVGMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!gameState) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const rows = gameState.map.length;
    const cols = gameState.map[0]?.length ?? 0;
    const hex = pixelToHex(px, py, rows, cols);
    if (!hex) { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); setTooltip(null); return; }

    const tile = gameState.map[hex.row]?.[hex.col];
    if (!tile) return;
    const unit = gameState.units.find(u => u.pos.row === hex.row && u.pos.col === hex.col && u.status !== "eliminated");
    const obj  = gameState.objectives.find(o => o.pos.row === hex.row && o.pos.col === hex.col);

    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        terrain: tile.terrain,
        unitName: unit?.name,
        unitStatus: unit?.status,
      });
      if (obj) setHoveredObjLabel(obj.label);
      else setHoveredObjLabel(null);
    }, 600);
  }, [gameState]);

  const handleSVGMouseLeave = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
    setHoveredObjLabel(null);
  }, []);

  const handleHexClick = useCallback((row: number, col: number) => {
    if (!gameState || gameState.result !== "ongoing" || gameState.faction !== "allied") return;
    const { phase, activeUnit } = gameState;

    if (phase === "movement" && activeUnit) {
      const key = `${row},${col}`;
      if (reachableTiles.has(key)) {
        const newState = moveUnit(gameState, activeUnit, { row, col });
        setReachableTiles(new Set(getReachableTiles(newState, activeUnit).map(p => `${p.row},${p.col}`)));
        setGameState(newState);
        return;
      }
    }

    const unitOnTile = gameState.units.find(u => u.pos.row === row && u.pos.col === col && u.status !== "eliminated");
    if (unitOnTile?.faction === "allied") {
      setGameState({ ...gameState, activeUnit: unitOnTile.id });
    } else {
      setGameState({ ...gameState, activeUnit: null });
    }
  }, [gameState, reachableTiles]);

  const triggerFX = useCallback((attacker: Unit, target: Unit) => {
    // ── Audio ──────────────────────────────────────────────────────────────
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ac = audioCtx.current;
      if (ac.state === "suspended") ac.resume();
      if (attacker.type === "mg")     playMGFire(ac);
      else if (attacker.type === "leader") playLeaderFire(ac);
      else                             playSquadFire(ac);
    } catch { /* audio blocked */ }

    // ── Tracers ────────────────────────────────────────────────────────────
    if (tracerCanvas.current) {
      const [ox, oy] = hexCenter(attacker.pos.row, attacker.pos.col);
      const [tx, ty] = hexCenter(target.pos.row,   target.pos.col);
      animateTracers(tracerCanvas.current, ox, oy, tx, ty, attacker.type);
    }
  }, []);

  const handleFireAt = useCallback((targetId: string) => {
    if (!gameState || !gameState.activeUnit) return;
    const attacker = gameState.units.find(u => u.id === gameState.activeUnit);
    const target   = gameState.units.find(u => u.id === targetId);
    if (attacker && target) triggerFX(attacker, target);
    setGameState(fireUnit(gameState, gameState.activeUnit, targetId));
  }, [gameState, triggerFX]);

  const handleRally = useCallback((unitId: string) => {
    if (!gameState) return;
    setGameState(rallyUnit(gameState, unitId));
  }, [gameState]);

  const handleEndPhase = useCallback(async () => {
    if (!gameState || gameState.result !== "ongoing") return;
    const { phase, faction } = gameState;

    if (faction === "allied" && phase === "rally") {
      let nextState = advancePhase(gameState);
      setGameState({ ...nextState, activeUnit: null });
      setReachableTiles(new Set()); setAttackableTargets(new Set());
      if (nextState.result !== "ongoing") return;

      setAxisActing(true); setAxisLog([]);
      await new Promise(r => setTimeout(r, 400));

      const beforeLog = nextState.log.slice();

      // Snapshot pre-AI unit positions for FX
      const preUnits = JSON.parse(JSON.stringify(nextState.units)) as typeof nextState.units;

      const afterState = runAxisAI(nextState);
      const newEntries = afterState.log.filter(l => !beforeLog.includes(l));

      // Fire FX for each axis unit that fired (log entry "X fires at Y")
      for (const entry of newEntries) {
        const match = entry.match(/^(.+?) fires at (.+?) →/);
        if (!match) continue;
        const [, attackerName] = match;
        const attacker = afterState.units.find(u => u.name === attackerName && u.faction === "axis");
        const target   = afterState.units.find(u => entry.includes(u.name) && u.faction === "allied");
        if (attacker && target) {
          const pre = preUnits.find(u => u.id === attacker.id);
          const aPos = pre?.pos ?? attacker.pos;
          triggerFX({ ...attacker, pos: aPos }, target);
        }
        await new Promise(r => setTimeout(r, 60));
      }

      for (let i = newEntries.length - 1; i >= 0; i--) {
        await new Promise(r => setTimeout(r, 200));
        setAxisLog(prev => [newEntries[newEntries.length - 1 - i], ...prev]);
      }

      await new Promise(r => setTimeout(r, 600));
      let finalState = advancePhase(afterState);
      finalState = { ...finalState, activeUnit: null };
      setAxisActing(false); setAxisLog([]);
      setGameState(finalState);
      return;
    }

    const nextState = advancePhase(gameState);
    setGameState({ ...nextState, activeUnit: null });
    setReachableTiles(new Set()); setAttackableTargets(new Set());
  }, [gameState]);

  // ── Briefing ──────────────────────────────────────────────────────────────

  if (showBriefing) return <BriefingScreen onStart={startGame} />;
  if (!gameState) return null;

  const { units, map, objectives, turn, turnsTotal, phase, faction, log, result, activeUnit, scenario } = gameState;
  const selectedUnit  = activeUnit ? units.find(u => u.id === activeUnit) ?? null : null;
  const alliedUnits   = units.filter(u => u.faction === "allied");
  const axisUnits     = units.filter(u => u.faction === "axis");
  const phaseLabel: Record<Phase, string> = { movement: "MOVEMENT", combat: "COMBAT", rally: "RALLY" };
  const factionColor  = faction === "allied" ? "#4488ff" : "#cc3333";
  const factionLabel  = faction === "allied" ? "Allied" : "Axis";

  // ── Game Over ─────────────────────────────────────────────────────────────

  if (result !== "ongoing") {
    const isWin = result === "allied_win";
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-6" style={{ background: "#05071a" }}>
        <div className="text-center p-8 rounded-xl max-w-md w-full"
          style={{ background: "#0a0f2e", border: `2px solid ${isWin ? "#ffd700" : "#cc3333"}` }}>
          <div className="text-6xl mb-4">{isWin ? "🏆" : "💀"}</div>
          <h2 className="font-orbitron text-3xl font-black mb-2" style={{ color: isWin ? "#ffd700" : "#cc3333" }}>
            {isWin ? "VICTORY" : "DEFEAT"}
          </h2>
          <p className="text-gray-300 mb-4 text-sm leading-relaxed">
            {isWin ? scenario.alliedWinCondition : scenario.axisWinCondition}
          </p>
          <p className="text-gray-500 text-xs mb-6">Turn {Math.min(turn, turnsTotal)} of {turnsTotal}</p>
          <button onClick={restartGame} className="px-8 py-3 rounded-lg font-orbitron font-bold text-sm tracking-wider"
            style={{ background: "#ffd70022", border: "1px solid #ffd70066", color: "#ffd700" }}>
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  // ── Map SVG dimensions ────────────────────────────────────────────────────

  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const SVG_W = cols * HEX_W + HEX_W / 2 + 4;
  const SVG_H = rows * ROW_H + (HEX_H - ROW_H) + 4;

  const unitAtPos = (r: number, c: number) =>
    units.find(u => u.pos.row === r && u.pos.col === c && u.status !== "eliminated");

  const objAtPos = (r: number, c: number) =>
    objectives.find(o => o.pos.row === r && o.pos.col === c);

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full" style={{ background: "#05071a", color: "#e2e8f0" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "#1e2a4a", background: "#070d20" }}>
        <div>
          <span className="font-orbitron font-black text-base" style={{ color: "#4488ff" }}>
            {scenario.title}
          </span>
          <span className="text-gray-500 text-xs ml-3">{scenario.subtitle}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: factionColor }} className="font-bold">[{factionLabel} Phase]</span>
          <span className="text-gray-400">Turn {turn}/{turnsTotal}</span>
          <span className="font-orbitron font-bold px-2 py-0.5 rounded text-xs"
            style={{ background: `${factionColor}22`, border: `1px solid ${factionColor}66`, color: factionColor }}>
            {phaseLabel[phase]}
          </span>
        </div>
      </div>

      {/* ── Objectives bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b text-xs"
        style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>
        <span className="text-gray-500 font-orbitron text-xs">OBJECTIVES:</span>
        {objectives.map(obj => {
          const isHighlighted = hoveredObjLabel === obj.label || hoveredObjBar === obj.label;
          const baseColor = obj.heldBy === "allied" ? "#4488ff"
            : obj.heldBy === "axis" ? "#cc3333" : "#888";
          return (
            <span
              key={obj.label}
              onMouseEnter={() => setHoveredObjBar(obj.label)}
              onMouseLeave={() => setHoveredObjBar(null)}
              className="px-2 py-0.5 rounded font-bold cursor-default transition-all"
              style={{
                background: isHighlighted ? `${baseColor}44` : `${baseColor}22`,
                border: `1px solid ${isHighlighted ? baseColor : baseColor + "66"}`,
                color: baseColor,
                boxShadow: isHighlighted ? `0 0 8px ${baseColor}88` : "none",
                transform: isHighlighted ? "scale(1.08)" : "scale(1)",
              }}
            >
              {obj.label} {obj.heldBy === "allied" ? "🪖" : obj.heldBy === "axis" ? "🎖️" : "○"}
            </span>
          );
        })}
        <span className="ml-auto text-gray-500">Need {scenario.alliedObjectivesNeeded}/{objectives.length} to win</span>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Hex map ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-2" style={{ position: "relative" }}>
          {/* Tracer canvas overlay — sits exactly on top of SVG, pointer-events:none */}
          <canvas
            ref={tracerCanvas}
            width={SVG_W}
            height={SVG_H}
            style={{
              position: "absolute",
              top: "8px",   // matches p-2
              left: "8px",
              width: SVG_W,
              height: SVG_H,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
          <svg
            width={SVG_W}
            height={SVG_H}
            style={{ display: "block", cursor: "crosshair" }}
            onMouseMove={handleSVGMouseMove}
            onMouseLeave={handleSVGMouseLeave}
          >
            {/* Terrain layer */}
            {map.map((row, r) => row.map((tile, c) => {
              const [cx, cy] = hexCenter(r, c);
              const pts = hexPoints(cx, cy, HEX_SIZE - 1);
              const posKey = `${r},${c}`;
              const isReachable = reachableTiles.has(posKey);
              const unit = unitAtPos(r, c);
              const obj  = objAtPos(r, c);
              const isAttackableTarget = unit && attackableTargets.has(unit.id);
              const isSelected = selectedUnit?.pos.row === r && selectedUnit?.pos.col === c;

              const isObjHighlighted = obj && (hoveredObjLabel === obj.label || hoveredObjBar === obj.label);

              let fill = TERRAIN_FILL[tile.terrain] ?? "#888";
              if (isReachable) fill = blendColor(fill, "#4488ff", 0.28);

              let strokeColor = TERRAIN_STROKE[tile.terrain] ?? "#555";
              let strokeW = "0.8";
              if (isSelected)          { strokeColor = "#ffffff"; strokeW = "2.5"; }
              else if (isAttackableTarget) { strokeColor = "#ef4444"; strokeW = "2.5"; }
              else if (isObjHighlighted)   { strokeColor = "#ffd700"; strokeW = "2.5"; }
              else if (obj)                { strokeColor = "#ffd70055"; strokeW = "1.5"; }

              return (
                <g key={`${r}-${c}`} onClick={() => handleHexClick(r, c)} style={{ cursor: "pointer" }}>
                  <polygon
                    points={pts}
                    fill={fill}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                  />
                  {isSelected && (
                    <polygon points={hexPoints(cx, cy, HEX_SIZE - 1)} fill="#ffffff" fillOpacity={0.08} stroke="none" />
                  )}
                  {isReachable && (
                    <polygon points={hexPoints(cx, cy, HEX_SIZE - 3)} fill="#4488ff" fillOpacity={0.15} stroke="none" />
                  )}
                  {/* Terrain icon (no unit) */}
                  {!unit && <TerrainIcon terrain={tile.terrain} cx={cx} cy={cy} />}
                  {/* Objective ring */}
                  {obj && !unit && (
                    <ObjectiveMarker cx={cx} cy={cy}
                      color={obj.heldBy === "allied" ? "#4488ff" : obj.heldBy === "axis" ? "#cc3333" : "#ffd700"} />
                  )}
                  {obj && unit && (
                    <circle cx={cx + 9} cy={cy - 9} r={5} fill="none"
                      stroke={obj.heldBy === "allied" ? "#4488ff" : obj.heldBy === "axis" ? "#cc3333" : "#ffd700"}
                      strokeWidth={1.5} />
                  )}
                  {/* Unit NATO symbol */}
                  {unit && (
                    <g
                      transform={`translate(${cx - 18},${cy - 14})`}
                      onClick={e => { e.stopPropagation(); if (unit.faction === "allied") setGameState(gs => gs ? { ...gs, activeUnit: unit.id } : gs); }}
                      style={{ filter: isAttackableTarget ? "drop-shadow(0 0 4px #ef4444)" : isSelected ? "drop-shadow(0 0 5px #ffffff)" : "none" }}
                    >
                      <svg width="36" height="26" viewBox="0 0 36 26" overflow="visible">
                        <NATOSymbol unit={unit} opacity={unit.status === "eliminated" ? 0.25 : unit.status === "broken" ? 0.55 : 1} />
                      </svg>
                    </g>
                  )}
                  {/* Status pip */}
                  {unit && unit.status !== "normal" && unit.status !== "eliminated" && (
                    <circle cx={cx + 12} cy={cy - 12} r={4}
                      fill={STATUS_COLORS[unit.status]} stroke="#05071a" strokeWidth={1} />
                  )}
                </g>
              );
            }))}
          </svg>

          {/* Terrain tooltip */}
          {tooltip && (
            <div
              style={{
                position: "absolute",
                left: tooltip.x + 14,
                top: tooltip.y + 14,
                pointerEvents: "none",
                zIndex: 50,
                background: "#0a0f2e",
                border: "1px solid #1e2a4a",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                maxWidth: 180,
                boxShadow: "0 2px 12px #000a",
              }}
            >
              <div className="font-bold text-white text-xs mb-0.5">{TERRAIN_LABEL[tooltip.terrain]}</div>
              <div style={{ color: "#94a3b8" }}>{TERRAIN_EFFECT[tooltip.terrain]}</div>
              {tooltip.unitName && (
                <div className="mt-1 border-t border-gray-700 pt-1" style={{ color: STATUS_COLORS[tooltip.unitStatus ?? "normal"] }}>
                  {tooltip.unitName} [{tooltip.unitStatus}]
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ borderColor: "#1e2a4a", background: "#060b1a" }}>

          {/* Selected unit */}
          {selectedUnit ? (
            <div className="p-3 border-b" style={{ borderColor: "#1e2a4a" }}>
              <div className="flex justify-center mb-2">
                <svg width="54" height="38" viewBox="0 0 54 38">
                  <g transform="translate(9,6)">
                    <svg width="36" height="26" viewBox="0 0 36 26" overflow="visible">
                      <NATOSymbol unit={selectedUnit} />
                    </svg>
                  </g>
                </svg>
              </div>
              <div className="font-bold text-sm text-center mb-1">{selectedUnit.name}</div>
              <div className="text-center mb-2">
                <span className="text-xs px-2 py-0.5 rounded font-bold"
                  style={{ background: `${STATUS_COLORS[selectedUnit.status]}22`, border: `1px solid ${STATUS_COLORS[selectedUnit.status]}66`, color: STATUS_COLORS[selectedUnit.status] }}>
                  {selectedUnit.status.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
                <div>ATK: <span className="text-white">{selectedUnit.attack}</span></div>
                <div>DEF: <span className="text-white">{selectedUnit.defense}</span></div>
                <div>MOV: <span className="text-white">{selectedUnit.movement - selectedUnit.mpUsed}/{selectedUnit.movement}</span></div>
                <div>RNG: <span className="text-white">{selectedUnit.range}</span></div>
                <div>MRL: <span className="text-white">{selectedUnit.morale}</span></div>
                <div>FIRE: <span className={selectedUnit.hasFired ? "text-red-400" : "text-green-400"}>{selectedUnit.hasFired ? "SPENT" : "READY"}</span></div>
              </div>

              {/* Actions */}
              <div className="mt-3 space-y-1">
                {phase === "combat" && !selectedUnit.hasFired && selectedUnit.status !== "eliminated" && (
                  <>
                    {getAttackableTargets(gameState, selectedUnit.id).map(target => (
                      <button key={target.id} onClick={() => handleFireAt(target.id)}
                        className="w-full text-left px-2 py-1 rounded text-xs transition"
                        style={{ background: "#cc333322", border: "1px solid #cc333366", color: "#ff8888" }}>
                        🎯 Fire: {target.name}
                      </button>
                    ))}
                    {getAttackableTargets(gameState, selectedUnit.id).length === 0 && (
                      <p className="text-gray-600 text-xs text-center">No targets in range</p>
                    )}
                  </>
                )}
                {phase === "rally" && (selectedUnit.status === "broken" || selectedUnit.status === "suppressed") && (
                  <button onClick={() => handleRally(selectedUnit.id)}
                    className="w-full px-2 py-1 rounded text-xs transition"
                    style={{ background: "#22c55e22", border: "1px solid #22c55e66", color: "#22c55e" }}>
                    🔄 Rally
                  </button>
                )}
              </div>

              <button onClick={() => setGameState(gs => gs ? { ...gs, activeUnit: null } : gs)}
                className="w-full mt-2 text-xs text-gray-600 hover:text-gray-400">
                Deselect
              </button>
            </div>
          ) : (
            <div className="p-3 border-b text-center text-gray-600 text-xs" style={{ borderColor: "#1e2a4a" }}>
              Click a unit to select
            </div>
          )}

          {/* Rally list */}
          {phase === "rally" && faction === "allied" && (
            <div className="p-2 border-b" style={{ borderColor: "#1e2a4a" }}>
              <div className="text-xs text-gray-500 mb-1 font-orbitron">RALLY</div>
              {alliedUnits.filter(u => u.status === "broken" || u.status === "suppressed").map(u => (
                <button key={u.id} onClick={() => handleRally(u.id)}
                  className="w-full text-left px-2 py-1 rounded text-xs mb-1 transition"
                  style={{ background: "#22c55e22", border: "1px solid #22c55e66", color: "#22c55e" }}>
                  🔄 {u.name} <span style={{ color: STATUS_COLORS[u.status] }}>[{u.status}]</span>
                </button>
              ))}
              {alliedUnits.filter(u => u.status === "broken" || u.status === "suppressed").length === 0 && (
                <p className="text-xs text-gray-600">All units nominal</p>
              )}
            </div>
          )}

          {/* Roster */}
          <div className="p-2 flex-1">
            <div className="text-xs mb-1 font-orbitron" style={{ color: "#4488ff88" }}>ALLIED</div>
            {alliedUnits.map(u => (
              <div key={u.id}
                onClick={() => u.status !== "eliminated" && setGameState(gs => gs ? { ...gs, activeUnit: u.id } : gs)}
                className="flex items-center gap-1 px-1 py-0.5 rounded mb-0.5 cursor-pointer transition"
                style={{
                  background: activeUnit === u.id ? "#4488ff22" : "transparent",
                  border: activeUnit === u.id ? "1px solid #4488ff44" : "1px solid transparent",
                  opacity: u.status === "eliminated" ? 0.4 : 1,
                }}>
                <svg width="22" height="16" viewBox="0 0 36 26"><NATOSymbol unit={u} /></svg>
                <span className="text-xs flex-1 truncate">{u.name}</span>
                <span style={{ fontSize: 8, color: STATUS_COLORS[u.status], fontWeight: "bold" }}>
                  {u.status === "normal" ? "●" : u.status === "suppressed" ? "S" : u.status === "broken" ? "B" : "✕"}
                </span>
              </div>
            ))}

            <div className="text-xs mt-3 mb-1 font-orbitron" style={{ color: "#cc333388" }}>AXIS</div>
            {axisUnits.map(u => (
              <div key={u.id} className="flex items-center gap-1 px-1 py-0.5 rounded mb-0.5"
                style={{ opacity: u.status === "eliminated" ? 0.4 : 1 }}>
                <svg width="22" height="16" viewBox="0 0 36 26"><NATOSymbol unit={u} /></svg>
                <span className="text-xs flex-1 truncate">{u.name}</span>
                <span style={{ fontSize: 8, color: STATUS_COLORS[u.status], fontWeight: "bold" }}>
                  {u.status === "normal" ? "●" : u.status === "suppressed" ? "S" : u.status === "broken" ? "B" : "✕"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <div className="border-t flex items-end gap-3 px-4 py-2"
        style={{ borderColor: "#1e2a4a", background: "#060b1a", minHeight: "90px" }}>
        <div className="flex-1 font-mono text-xs space-y-0.5">
          {log.slice(0, 4).map((entry, i) => (
            <div key={i} style={{ color: i === 0 ? "#e2e8f0" : "#6b7280", fontWeight: i === 0 ? "bold" : "normal" }}>
              {i === 0 ? "▶ " : "  "}{entry}
            </div>
          ))}
        </div>
        <div className="flex-shrink-0">
          {faction === "allied" && !axisActing && (
            <button onClick={handleEndPhase}
              className="px-4 py-2 rounded-lg font-orbitron font-bold text-xs tracking-wider transition"
              style={{ background: "#4488ff22", border: "1px solid #4488ff66", color: "#4488ff" }}>
              End {phaseLabel[phase]}{phase === "rally" ? " → Axis" : ""}
            </button>
          )}
          {axisActing && (
            <div className="px-4 py-2 rounded-lg font-orbitron font-bold text-xs text-center"
              style={{ background: "#cc333322", border: "1px solid #cc333366", color: "#cc3333", minWidth: "120px" }}>
              <div className="animate-pulse">Axis Acting...</div>
              <div className="mt-1 space-y-0.5">
                {axisLog.slice(0, 3).map((l, i) => (
                  <div key={i} className="text-gray-400 font-normal text-xs truncate max-w-[140px]">{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Axis overlay */}
      {axisActing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="p-6 rounded-xl font-orbitron text-center"
            style={{ background: "#0a0f2e", border: "2px solid #cc3333", color: "#cc3333", pointerEvents: "none" }}>
            <div className="animate-pulse text-lg font-black mb-2">AXIS TURN</div>
            <div className="text-xs text-gray-400 space-y-1">
              {axisLog.slice(0, 5).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Briefing screen ──────────────────────────────────────────────────────────

function BriefingScreen({ onStart }: { onStart: () => void }) {
  const scenario = normandyScenario;
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 overflow-y-auto" style={{ background: "#05071a" }}>
      <div className="max-w-xl w-full rounded-xl overflow-hidden"
        style={{ border: "2px solid #4488ff44", background: "#070d20" }}>

        <div className="px-6 py-4 text-center" style={{ background: "#0a1440", borderBottom: "1px solid #1e2a4a" }}>
          <div className="font-orbitron text-xs text-gray-500 mb-1 tracking-widest">OPERATION BRIEFING</div>
          <h1 className="font-orbitron text-2xl font-black mb-1" style={{ color: "#ffd700" }}>{scenario.title}</h1>
          <p className="text-gray-400 text-sm">{scenario.subtitle}</p>
        </div>

        <div className="px-6 py-4 border-b text-sm leading-relaxed text-gray-300 whitespace-pre-line"
          style={{ borderColor: "#1e2a4a" }}>
          {scenario.briefing}
        </div>

        <div className="grid grid-cols-2 gap-0 border-b" style={{ borderColor: "#1e2a4a" }}>
          <div className="p-4 border-r" style={{ borderColor: "#1e2a4a" }}>
            <div className="font-orbitron text-xs mb-3" style={{ color: "#4488ff" }}>🪖 ALLIED FORCES</div>
            {scenario.units.filter(u => u.faction === "allied").map(u => (
              <div key={u.id} className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <svg width="28" height="20" viewBox="0 0 36 26">
                  <NATOSymbol unit={{ ...u, status: "normal", mpUsed: 0, hasFired: false }} />
                </svg>
                <span>{u.name}</span>
              </div>
            ))}
          </div>
          <div className="p-4">
            <div className="font-orbitron text-xs mb-3" style={{ color: "#cc3333" }}>🎖️ AXIS FORCES</div>
            {scenario.units.filter(u => u.faction === "axis").map(u => (
              <div key={u.id} className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <svg width="28" height="20" viewBox="0 0 36 26">
                  <NATOSymbol unit={{ ...u, status: "normal", mpUsed: 0, hasFired: false }} />
                </svg>
                <span>{u.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b" style={{ borderColor: "#1e2a4a" }}>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-orbitron mb-1" style={{ color: "#4488ff" }}>ALLIED WIN</div>
              <p className="text-gray-400">{scenario.alliedWinCondition}</p>
            </div>
            <div>
              <div className="font-orbitron mb-1" style={{ color: "#cc3333" }}>AXIS WIN</div>
              <p className="text-gray-400">{scenario.axisWinCondition}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            🏆 Hold <span className="text-yellow-400 font-bold">{scenario.alliedObjectivesNeeded} of {scenario.objectives.length}</span> objectives by turn {scenario.turnsTotal}
          </div>
        </div>

        <div className="px-6 py-3 border-b" style={{ borderColor: "#1e2a4a" }}>
          <div className="font-orbitron text-xs mb-2" style={{ color: "#ffd700" }}>📍 OBJECTIVES</div>
          <div className="flex gap-3">
            {scenario.objectives.map(o => (
              <div key={o.label} className="text-xs px-2 py-1 rounded"
                style={{ background: "#ffd70011", border: "1px solid #ffd70033", color: "#ffd700" }}>
                {o.label}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 text-center">
          <button onClick={onStart}
            className="px-10 py-3 rounded-lg font-orbitron font-black text-base tracking-widest transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#4488ff22,#4488ff44)", border: "2px solid #4488ff", color: "#4488ff", boxShadow: "0 0 20px #4488ff44" }}>
            BEGIN MISSION
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function blendColor(hex1: string, hex2: string, t: number): string {
  const parse = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = parse(hex1);
  const [r2,g2,b2] = parse(hex2);
  return `rgb(${Math.round(r1*(1-t)+r2*t)},${Math.round(g1*(1-t)+g2*t)},${Math.round(b1*(1-t)+b2*t)})`;
}
