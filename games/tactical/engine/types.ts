// Terrain types — affects movement cost and cover
export type TerrainType =
  | "open"        // no cover, 1 MP
  | "road"        // no cover, 0.5 MP (fast movement)
  | "woods"       // +2 defense, 2 MP, blocks LOS beyond 2 tiles
  | "building"    // +3 defense, 2 MP, blocks LOS
  | "rubble"      // +1 defense, 2 MP
  | "wall"        // +1 defense, 1 MP, partial LOS block
  | "wheatfield"; // +1 defense, 1 MP, blocks LOS beyond 3 tiles

export type Faction = "allied" | "axis";
export type UnitType = "infantry" | "leader" | "mg" | "mortar" | "vehicle";
export type UnitStatus = "normal" | "suppressed" | "broken" | "eliminated";
export type Phase = "movement" | "combat" | "rally";
export type GameResult = "ongoing" | "allied_win" | "axis_win" | "draw";

export interface Pos {
  row: number;
  col: number;
}

export interface Unit {
  id: string;
  name: string;          // e.g. "1st Squad", "MG42 Team"
  faction: Faction;
  type: UnitType;
  attack: number;        // firepower rating
  defense: number;       // base defense modifier
  movement: number;      // movement points per turn
  range: number;         // attack range in tiles
  morale: number;        // 1–10; below 3 = broken
  pos: Pos;
  status: UnitStatus;
  mpUsed: number;        // movement points spent this turn
  hasFired: boolean;     // fired this turn
  emoji: string;         // display icon
}

export interface Tile {
  terrain: TerrainType;
  objective?: boolean;   // capture-point tile
  objectiveHeldBy?: Faction | null;
}

export type GameMap = Tile[][];

export interface ObjectiveState {
  pos: Pos;
  heldBy: Faction | null;
  label: string;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  subtitle: string;
  briefing: string;           // flavor text shown before game starts
  map: GameMap;
  units: Omit<Unit, "mpUsed" | "hasFired" | "status">[];
  objectives: { pos: Pos; label: string }[];
  turnsTotal: number;
  alliedWinCondition: string; // human-readable
  axisWinCondition: string;
  // Win logic: allied wins if they hold >= alliedObjectivesNeeded objectives at end
  alliedObjectivesNeeded: number;
}

export interface GameState {
  map: GameMap;
  units: Unit[];
  objectives: ObjectiveState[];
  turn: number;
  turnsTotal: number;
  phase: Phase;
  activeUnit: string | null;   // id of selected unit
  faction: Faction;            // whose turn it is (allied always goes first)
  log: string[];               // combat log, newest first
  result: GameResult;
  scenario: ScenarioDefinition;
}
