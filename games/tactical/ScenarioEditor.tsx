"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioDefinition } from "./schema";
import type { Faction, TerrainType, UnitType } from "./engine/types";
import { useEditorHistory } from "./engine/useEditorHistory";

// ─── Hex geometry (mirrors TacticalGame.tsx) ─────────────────────────────────
const HEX_SIZE = 26;
const HEX_W = Math.round(Math.sqrt(3) * HEX_SIZE);
const HEX_H = HEX_SIZE * 2;
const ROW_H = Math.round(HEX_H * 0.75);

function hexCenter(row: number, col: number): [number, number] {
  const x = col * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0) + HEX_W / 2;
  const y = row * ROW_H + HEX_H / 2;
  return [x, y];
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

// ─── Terrain visuals (mirrors TacticalGame.tsx) ──────────────────────────────
const TERRAIN_FILL: Record<TerrainType, string> = {
  open: "#b8a85c",
  road: "#7a6540",
  woods: "#2a5218",
  building: "#7a5c10",
  rubble: "#5a5a5a",
  wall: "#8a7a5a",
  wheatfield: "#c89830",
};

const TERRAIN_STROKE: Record<TerrainType, string> = {
  open: "#9a8a48",
  road: "#5a4828",
  woods: "#1a3a0c",
  building: "#5a4008",
  rubble: "#3a3a3a",
  wall: "#6a5a3a",
  wheatfield: "#a07820",
};

const TERRAIN_TOOLS: { terrain: TerrainType; label: string; emoji: string }[] = [
  { terrain: "open", label: "Open", emoji: "🟫" },
  { terrain: "woods", label: "Woods", emoji: "🟩" },
  { terrain: "building", label: "Building", emoji: "🏚" },
  { terrain: "wheatfield", label: "Wheatfield", emoji: "🟨" },
  { terrain: "road", label: "Road", emoji: "🛣" },
  { terrain: "rubble", label: "Rubble", emoji: "🪨" },
  { terrain: "wall", label: "Wall", emoji: "🧱" },
];

// ─── Unit templates (used for freshly placed units) ──────────────────────────
type UnitTemplate = {
  name: string;
  attack: number;
  defense: number;
  movement: number;
  range: number;
  morale: number;
  emoji: string;
};

const UNIT_TEMPLATES: Record<Faction, Record<UnitType, UnitTemplate>> = {
  allied: {
    infantry: { name: "Rifle Squad", attack: 4, defense: 3, movement: 4, range: 3, morale: 7, emoji: "🪖" },
    leader: { name: "Sergeant", attack: 2, defense: 2, movement: 5, range: 2, morale: 9, emoji: "⭐" },
    mg: { name: "BAR Team", attack: 6, defense: 2, movement: 3, range: 5, morale: 7, emoji: "🔫" },
    mortar: { name: "Mortar Team", attack: 5, defense: 2, movement: 2, range: 6, morale: 6, emoji: "💣" },
    vehicle: { name: "Sherman", attack: 8, defense: 6, movement: 5, range: 5, morale: 9, emoji: "🛡" },
  },
  axis: {
    infantry: { name: "Schütze", attack: 4, defense: 3, movement: 4, range: 3, morale: 7, emoji: "🪖" },
    leader: { name: "Unteroffizier", attack: 2, defense: 2, movement: 5, range: 2, morale: 9, emoji: "⭐" },
    mg: { name: "MG-42 Team", attack: 7, defense: 2, movement: 2, range: 6, morale: 7, emoji: "🔫" },
    mortar: { name: "Granatwerfer", attack: 5, defense: 2, movement: 2, range: 6, morale: 6, emoji: "💣" },
    vehicle: { name: "Panzer IV", attack: 8, defense: 7, movement: 5, range: 5, morale: 9, emoji: "🛡" },
  },
};

const UNIT_PALETTE: { faction: Faction; type: UnitType; emoji: string; label: string }[] = [
  { faction: "allied", type: "infantry", emoji: "🪖", label: "Rifle Squad" },
  { faction: "allied", type: "leader", emoji: "⭐", label: "Leader" },
  { faction: "allied", type: "mg", emoji: "🔫", label: "MG Team" },
  { faction: "allied", type: "mortar", emoji: "💣", label: "Mortar" },
  { faction: "allied", type: "vehicle", emoji: "🛡", label: "Sherman" },
  { faction: "axis", type: "infantry", emoji: "🪖", label: "Schütze" },
  { faction: "axis", type: "leader", emoji: "⭐", label: "Leader" },
  { faction: "axis", type: "mg", emoji: "🔫", label: "MG-42" },
  { faction: "axis", type: "mortar", emoji: "💣", label: "Granatwerfer" },
  { faction: "axis", type: "vehicle", emoji: "🛡", label: "Panzer IV" },
];

const FACTION_COLOR: Record<Faction, string> = { allied: "#4488ff", axis: "#cc3333" };

type SelectedTool =
  | { kind: "terrain"; terrain: TerrainType }
  | { kind: "terrain-eraser" }
  | { kind: "unit"; faction: Faction; unitType: UnitType }
  | { kind: "unit-eraser" }
  | { kind: "objective" }
  | { kind: "objective-eraser" };

type EditorUnit = ScenarioDefinition["units"][number];

const posKey = (row: number, col: number) => `${row},${col}`;

function newUnitId(faction: Faction, type: UnitType) {
  return `${faction}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Small UI helpers ────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-orbitron text-[10px] tracking-[0.2em] text-gray-500 mt-4 mb-2 first:mt-0">
      {children}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  disabled,
  children,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition disabled:cursor-not-allowed ${
        active ? "bg-indigo-900/40 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
      }`}
      style={
        active
          ? { boxShadow: "inset 0 0 0 2px #6366f1" }
          : danger
            ? { color: "#ef4444" }
            : undefined
      }
    >
      {children}
    </button>
  );
}

export default function ScenarioEditor({
  scenarioId,
  initialScenario,
}: {
  scenarioId: string;
  initialScenario: ScenarioDefinition;
}) {
  const router = useRouter();

  const {
    scenario,
    commit,
    beginStroke,
    paint,
    endStroke,
    undo,
    redo,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
  } = useEditorHistory<ScenarioDefinition>(initialScenario);

  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [selectedTool, setSelectedTool] = useState<SelectedTool | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [stackPicker, setStackPicker] = useState<{ row: number; col: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const draggingRef = useRef(false);
  const touchRef = useRef(false);
  const strokeActiveRef = useRef(false);

  const rows = scenario.map.length;
  const cols = scenario.map[0]?.length ?? 0;
  const svgW = cols * HEX_W + HEX_W;
  const svgH = (rows - 1) * ROW_H + HEX_H + 8;

  const editing = mode === "edit";

  const unitsAt = useCallback(
    (row: number, col: number) => scenario.units.filter(u => u.pos.row === row && u.pos.col === col),
    [scenario.units]
  );

  const objectiveAt = useCallback(
    (row: number, col: number) =>
      scenario.objectives.find(o => o.pos.row === row && o.pos.col === col),
    [scenario.objectives]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const setTerrainIn = (draft: ScenarioDefinition, row: number, col: number, terrain: TerrainType) => {
    const tile = draft.map[row]?.[col];
    if (tile) tile.terrain = terrain;
  };

  const removeUnitsIn = (draft: ScenarioDefinition, row: number, col: number) => {
    draft.units = draft.units.filter(u => !(u.pos.row === row && u.pos.col === col));
  };

  const removeObjectivesIn = (draft: ScenarioDefinition, row: number, col: number) => {
    draft.objectives = draft.objectives.filter(o => !(o.pos.row === row && o.pos.col === col));
    const tile = draft.map[row]?.[col];
    if (tile) {
      tile.objective = false;
      tile.objectiveHeldBy = null;
    }
  };

  const placeUnit = (row: number, col: number, faction: Faction, type: UnitType) => {
    const tpl = UNIT_TEMPLATES[faction][type];
    const unit: EditorUnit = {
      id: newUnitId(faction, type),
      name: tpl.name,
      faction,
      type,
      attack: tpl.attack,
      defense: tpl.defense,
      movement: tpl.movement,
      range: tpl.range,
      morale: tpl.morale,
      pos: { row, col },
      emoji: tpl.emoji,
    };
    commit(draft => { draft.units = [...draft.units, unit]; });
  };

  const placeObjective = (row: number, col: number) => {
    const existing = objectiveAt(row, col);
    if (existing) return;
    const raw = window.prompt("Objective label", `Objective ${scenario.objectives.length + 1}`);
    if (raw === null) return;
    const label = raw.trim() || `Objective ${scenario.objectives.length + 1}`;
    commit(draft => {
      draft.objectives = [...draft.objectives, { pos: { row, col }, label }];
      const tile = draft.map[row]?.[col];
      if (tile) {
        tile.objective = true;
        tile.objectiveHeldBy = tile.objectiveHeldBy ?? null;
      }
    });
  };

  const moveUnit = (unitId: string, row: number, col: number) => {
    const unit = scenario.units.find(u => u.id === unitId);
    if (!unit || (unit.pos.row === row && unit.pos.col === col)) return;
    commit(draft => {
      const target = draft.units.find(u => u.id === unitId);
      if (target) target.pos = { row, col };
    });
  };

  /** One-shot tools: units, objectives, and clicking with a unit selected. */
  const applyOnce = (row: number, col: number) => {
    if (!editing) return;
    const tool = selectedTool;

    if (selectedUnitId) {
      moveUnit(selectedUnitId, row, col);
      return;
    }

    if (!tool) {
      const stack = unitsAt(row, col);
      if (stack.length === 1) {
        setSelectedUnitId(stack[0].id);
      } else if (stack.length > 1) {
        setStackPicker({ row, col });
      } else {
        setSelectedUnitId(null);
      }
      return;
    }

    if (tool.kind === "unit") {
      placeUnit(row, col, tool.faction, tool.unitType);
    } else if (tool.kind === "objective") {
      placeObjective(row, col);
    }
  };

  /** Painterly tools: terrain and erasers (support drag). */
  const isPaintTool = (tool: SelectedTool | null) =>
    !!tool &&
    (tool.kind === "terrain" ||
      tool.kind === "terrain-eraser" ||
      tool.kind === "unit-eraser" ||
      tool.kind === "objective-eraser");

  const applyPaint = (row: number, col: number) => {
    const tool = selectedTool;
    if (!tool) return;
    if (tool.kind === "terrain") {
      paint(draft => setTerrainIn(draft, row, col, tool.terrain));
    } else if (tool.kind === "terrain-eraser") {
      paint(draft => setTerrainIn(draft, row, col, "open"));
    } else if (tool.kind === "unit-eraser") {
      paint(draft => removeUnitsIn(draft, row, col));
    } else if (tool.kind === "objective-eraser") {
      paint(draft => removeObjectivesIn(draft, row, col));
    }
  };

  // ── Pointer handling ───────────────────────────────────────────────────────
  const handlePointerDown = (row: number, col: number, touch: boolean) => {
    if (!editing) return;
    touchRef.current = touch;

    if (selectedUnitId) {
      applyOnce(row, col);
      return;
    }

    if (isPaintTool(selectedTool)) {
      beginStroke();
      strokeActiveRef.current = true;
      applyPaint(row, col);
      draggingRef.current = !touch; // no drag painting on touch devices
      if (touch) {
        // Single tap → commit immediately.
        endStroke();
        strokeActiveRef.current = false;
        draggingRef.current = false;
      }
      return;
    }

    applyOnce(row, col);
  };

  const handlePointerEnter = (row: number, col: number) => {
    if (!editing) return;
    if (touchRef.current) return;
    if (!draggingRef.current || !strokeActiveRef.current) return;
    if (!isPaintTool(selectedTool)) return;
    applyPaint(row, col);
  };

  // End a drag stroke wherever the mouse is released.
  useEffect(() => {
    const finish = () => {
      if (draggingRef.current || strokeActiveRef.current) {
        endStroke();
      }
      draggingRef.current = false;
      strokeActiveRef.current = false;
    };
    window.addEventListener("mouseup", finish);
    window.addEventListener("touchend", finish);
    window.addEventListener("touchcancel", finish);
    return () => {
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("touchend", finish);
      window.removeEventListener("touchcancel", finish);
    };
  }, [endStroke]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const selectUnit = (id: string) => {
    setSelectedUnitId(id);
    setSelectedTool(null);
    setStackPicker(null);
  };

  const selectTool = (tool: SelectedTool | null) => {
    setSelectedTool(tool);
    setSelectedUnitId(null);
    setStackPicker(null);
  };

  const handleDone = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: scenario }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save the scenario.");
        return;
      }
      router.push(`/play/${scenarioId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const alliedUnits = scenario.units.filter(u => u.faction === "allied");
  const axisUnits = scenario.units.filter(u => u.faction === "axis");
  const selectedUnit = scenario.units.find(u => u.id === selectedUnitId) ?? null;

  const stackUnits = stackPicker ? unitsAt(stackPicker.row, stackPicker.col) : [];

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 56px)", background: "#05071a" }}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: palette ────────────────────────────────────────────── */}
        <aside
          className="w-52 flex-shrink-0 overflow-y-auto relative bg-gray-900/60 border-r border-gray-800 p-3"
        >
          <div className={editing ? "" : "pointer-events-none opacity-40"}>
            <SectionTitle>TERRAIN</SectionTitle>
            {TERRAIN_TOOLS.map(t => (
              <ToolButton
                key={t.terrain}
                active={selectedTool?.kind === "terrain" && selectedTool.terrain === t.terrain}
                onClick={() => selectTool({ kind: "terrain", terrain: t.terrain })}
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: TERRAIN_FILL[t.terrain], border: `1px solid ${TERRAIN_STROKE[t.terrain]}` }}
                />
                {t.label}
              </ToolButton>
            ))}
            <ToolButton
              active={selectedTool?.kind === "terrain-eraser"}
              onClick={() => selectTool({ kind: "terrain-eraser" })}
              danger
            >
              <span className="inline-block w-3 h-3 rounded-sm border border-gray-600 flex-shrink-0" />
              Eraser
            </ToolButton>

            <SectionTitle>ALLIED</SectionTitle>
            {UNIT_PALETTE.filter(u => u.faction === "allied").map(u => (
              <ToolButton
                key={`allied-${u.type}`}
                active={
                  selectedTool?.kind === "unit" &&
                  selectedTool.faction === "allied" &&
                  selectedTool.unitType === u.type
                }
                onClick={() => selectTool({ kind: "unit", faction: "allied", unitType: u.type })}
              >
                <span className="w-4 text-center flex-shrink-0">{u.emoji}</span>
                {u.label}
              </ToolButton>
            ))}
            <ToolButton
              active={selectedTool?.kind === "unit-eraser"}
              onClick={() => selectTool({ kind: "unit-eraser" })}
              danger
            >
              <span className="w-4 text-center flex-shrink-0">✕</span>
              Eraser
            </ToolButton>

            <SectionTitle>AXIS</SectionTitle>
            {UNIT_PALETTE.filter(u => u.faction === "axis").map(u => (
              <ToolButton
                key={`axis-${u.type}`}
                active={
                  selectedTool?.kind === "unit" &&
                  selectedTool.faction === "axis" &&
                  selectedTool.unitType === u.type
                }
                onClick={() => selectTool({ kind: "unit", faction: "axis", unitType: u.type })}
              >
                <span className="w-4 text-center flex-shrink-0">{u.emoji}</span>
                {u.label}
              </ToolButton>
            ))}
            <ToolButton
              active={selectedTool?.kind === "unit-eraser"}
              onClick={() => selectTool({ kind: "unit-eraser" })}
              danger
            >
              <span className="w-4 text-center flex-shrink-0">✕</span>
              Eraser
            </ToolButton>

            <SectionTitle>OBJECTIVES</SectionTitle>
            <ToolButton
              active={selectedTool?.kind === "objective"}
              onClick={() => selectTool({ kind: "objective" })}
            >
              <span className="w-4 text-center flex-shrink-0">🎯</span>
              Objective
            </ToolButton>
            <ToolButton
              active={selectedTool?.kind === "objective-eraser"}
              onClick={() => selectTool({ kind: "objective-eraser" })}
              danger
            >
              <span className="w-4 text-center flex-shrink-0">✕</span>
              Eraser
            </ToolButton>
          </div>

          {!editing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded text-center"
                style={{ background: "#05071ae6", border: "1px solid #1e2a4a", color: "#94a3b8" }}
              >
                CLICK EDIT<br />TO MODIFY
              </span>
            </div>
          )}
        </aside>

        {/* ── CENTER: hex map ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto relative p-4">
          <div className="flex justify-center">
            <svg
              width={svgW}
              height={svgH}
              style={{
                display: "block",
                cursor: editing ? "crosshair" : "default",
                maxWidth: "100%",
              }}
              onMouseLeave={() => setStackPicker(null)}
            >
              {scenario.map.map((rowTiles, r) =>
                rowTiles.map((tile, c) => {
                  const [cx, cy] = hexCenter(r, c);
                  const unitsHere = unitsAt(r, c);
                  const obj = objectiveAt(r, c);
                  const unitSelected = selectedUnit?.pos.row === r && selectedUnit?.pos.col === c;
                  const stackOpen = stackPicker?.row === r && stackPicker?.col === c;

                  const fill = TERRAIN_FILL[tile.terrain] ?? "#888";
                  const stroke = unitSelected
                    ? "#ffffff"
                    : stackOpen
                      ? "#6366f1"
                      : TERRAIN_STROKE[tile.terrain] ?? "#555";

                  return (
                    <g
                      key={posKey(r, c)}
                      onMouseDown={() => handlePointerDown(r, c, false)}
                      onMouseEnter={() => handlePointerEnter(r, c)}
                      onTouchStart={e => {
                        e.preventDefault();
                        handlePointerDown(r, c, true);
                      }}
                    >
                      <polygon
                        points={hexPoints(cx, cy, HEX_SIZE - 1)}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={unitSelected ? 2.5 : 0.8}
                      />

                      {obj && (
                        <text
                          x={cx - 12}
                          y={cy - 10}
                          fontSize={11}
                          fill="#ffd700"
                          style={{ pointerEvents: "none" }}
                        >
                          ★
                        </text>
                      )}

                      {unitsHere.map((u, i) => (
                        <g key={u.id} style={{ pointerEvents: "none" }}>
                          <rect
                            x={cx - 9 + i * 2}
                            y={cy - 8 + i * 2}
                            width={18}
                            height={16}
                            rx={3}
                            fill={`${FACTION_COLOR[u.faction]}44`}
                            stroke={FACTION_COLOR[u.faction]}
                            strokeWidth={u.id === selectedUnitId ? 2.5 : 1}
                          />
                          <text
                            x={cx + i * 2}
                            y={cy + 4 + i * 2}
                            textAnchor="middle"
                            fontSize={11}
                          >
                            {u.emoji}
                          </text>
                        </g>
                      ))}

                      {unitSelected && (
                        <polygon
                          points={hexPoints(cx, cy, HEX_SIZE - 4)}
                          fill="none"
                          stroke="#a5b4fc"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </g>
                  );
                })
              )}
            </svg>
          </div>

          {/* Multi-unit stack picker */}
          {stackPicker && stackUnits.length > 1 && (
            <div
              className="absolute z-40 rounded-lg p-2 space-y-1"
              style={{
                left: "50%",
                top: 24,
                transform: "translateX(-50%)",
                background: "#0a0f2e",
                border: "1px solid #1e2a4a",
                boxShadow: "0 2px 12px #000a",
              }}
            >
              <div className="font-orbitron text-[10px] tracking-widest text-gray-500 px-1 pb-1">
                SELECT UNIT
              </div>
              {stackUnits.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selectUnit(u.id)}
                  className="block w-full text-left text-xs px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  {u.emoji} {u.name}
                  <span className="ml-2 text-[10px]" style={{ color: FACTION_COLOR[u.faction] }}>
                    {u.faction}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedUnit && editing && (
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1.5 rounded"
              style={{ background: "#0a0f2e", border: "1px solid #6366f1", color: "#c7d2fe" }}
            >
              {selectedUnit.name} selected — click a hex to move
            </div>
          )}
        </main>

        {/* ── RIGHT: inventory ─────────────────────────────────────────── */}
        <aside className="w-60 flex-shrink-0 overflow-y-auto bg-gray-900/60 border-l border-gray-800 p-3">
          <SectionTitle>ALLIED</SectionTitle>
          {alliedUnits.length === 0 && (
            <p className="text-[11px] text-gray-600 px-2">No allied units.</p>
          )}
          {alliedUnits.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectUnit(u.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition ${
                u.id === selectedUnitId
                  ? "bg-indigo-900/40 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <span className="w-4 text-center flex-shrink-0">{u.emoji}</span>
              <span className="truncate">{u.name}</span>
              <span className="ml-auto text-[10px] text-gray-600 flex-shrink-0">
                {u.pos.row},{u.pos.col}
              </span>
            </button>
          ))}

          <SectionTitle>AXIS</SectionTitle>
          {axisUnits.length === 0 && (
            <p className="text-[11px] text-gray-600 px-2">No axis units.</p>
          )}
          {axisUnits.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectUnit(u.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition ${
                u.id === selectedUnitId
                  ? "bg-indigo-900/40 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <span className="w-4 text-center flex-shrink-0">{u.emoji}</span>
              <span className="truncate">{u.name}</span>
              <span className="ml-auto text-[10px] text-gray-600 flex-shrink-0">
                {u.pos.row},{u.pos.col}
              </span>
            </button>
          ))}

          <SectionTitle>OBJECTIVES</SectionTitle>
          {scenario.objectives.length === 0 && (
            <p className="text-[11px] text-gray-600 px-2">No objectives.</p>
          )}
          {scenario.objectives.map(o => (
            <div
              key={`${o.pos.row}-${o.pos.col}-${o.label}`}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400"
            >
              <span className="w-4 text-center flex-shrink-0">🎯</span>
              <span className="truncate">{o.label}</span>
              <span className="ml-auto text-[10px] text-gray-600 flex-shrink-0">
                {o.pos.row},{o.pos.col}
              </span>
            </div>
          ))}
        </aside>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2 border-t border-gray-800"
        style={{ background: "#060b1a" }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title={`Undo (Ctrl+Z)${undoCount ? ` — ${undoCount} step${undoCount === 1 ? "" : "s"}` : ""}`}
            className="px-3 py-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-gray-800"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title={`Redo (Ctrl+Shift+Z)${redoCount ? ` — ${redoCount} step${redoCount === 1 ? "" : "s"}` : ""}`}
            className="px-3 py-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-gray-800"
          >
            ↪ Redo
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "#0a0f2e", border: "1px solid #1e2a4a" }}>
          {(["preview", "edit"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                if (m === "preview") {
                  setSelectedTool(null);
                  setSelectedUnitId(null);
                  setStackPicker(null);
                }
              }}
              className={`font-orbitron text-[10px] tracking-widest px-4 py-1.5 rounded transition ${
                mode === m ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
              style={
                mode === m
                  ? { background: "#6366f122", border: "1px solid #6366f166" }
                  : { border: "1px solid transparent" }
              }
            >
              {m === "preview" ? "PREVIEW" : "EDIT"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {error && <span className="text-xs" style={{ color: "#f87171" }}>{error}</span>}
          <button
            type="button"
            onClick={handleDone}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl font-orbitron font-black text-sm tracking-widest transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            style={{
              background: "linear-gradient(135deg, #6366f1, #4488ff)",
              color: "#ffffff",
              boxShadow: "0 0 20px #6366f144",
            }}
          >
            {saving ? "SAVING…" : "DONE →"}
          </button>
        </div>
      </div>
    </div>
  );
}
