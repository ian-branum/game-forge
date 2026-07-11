import type { ScenarioDefinition, Tile, TerrainType } from "@/lib/squad-leader/types";

interface ZoneDescriptor {
  name: string;
  terrain: TerrainType;
  features?: string[];
  objective?: string | null;
}

interface AIUnit {
  id: string;
  name: string;
  faction: "allied" | "axis";
  type: "infantry" | "leader" | "mg" | "mortar" | "vehicle";
  attack: number;
  defense: number;
  movement: number;
  range: number;
  morale: number;
  pos: { row: number; col: number };
  emoji: string;
}

interface AIScenarioOutput {
  title: string;
  subtitle: string;
  briefing: string;
  zones: ZoneDescriptor[];
  alliedFaction: string;
  axisFaction: string;
  units: AIUnit[];
  objectives: { pos: { row: number; col: number }; label: string }[];
  turnsTotal: number;
  alliedObjectivesNeeded: number;
  alliedWinCondition: string;
  axisWinCondition: string;
}

const SYSTEM_PROMPT = `You are a tactical wargame scenario designer. Given a battle description, output a JSON object describing the battlefield and units.

The map is 12 rows × 16 columns of hexagonal tiles.
Allied units start in the bottom rows (rows 8-11), Axis units in the top rows (rows 0-5).
Objectives are typically in the middle rows (rows 4-8).

Terrain types: "open", "road", "woods", "building", "rubble", "wall", "wheatfield"
Unit types: "infantry", "leader", "mg", "mortar", "vehicle"
Factions: "allied" or "axis"

Output ONLY valid JSON, no markdown, no explanation. Schema:
{
  "title": string,
  "subtitle": string,
  "briefing": string (2-3 paragraphs of flavor text),
  "zones": [
    { "name": "north", "terrain": "woods", "features": [], "objective": null },
    { "name": "center", "terrain": "building", "features": ["road_ew"], "objective": "Village Center" },
    { "name": "south", "terrain": "open", "features": [], "objective": null },
    { "name": "east", "terrain": "open", "features": ["road_ns"], "objective": null },
    { "name": "west", "terrain": "woods", "features": [], "objective": null }
  ],
  "alliedFaction": string,
  "axisFaction": string,
  "units": [ { "id", "name", "faction", "type", "attack", "defense", "movement", "range", "morale", "pos", "emoji" } ],
  "objectives": [ { "pos": { "row": number, "col": number }, "label": string } ],
  "turnsTotal": number (8-12),
  "alliedObjectivesNeeded": number,
  "alliedWinCondition": string,
  "axisWinCondition": string
}

Balance guidelines:
- 3-5 allied units, 3-5 axis units
- Always include 1 leader per side (morale 9, higher movement)
- Allied attack ratings 3-5, axis defense ratings 2-4
- MG teams: attack 6-7, range 6-7, movement 2-3
- Infantry: attack 3-5, defense 2-3, movement 4, range 4
- Morale 6-9 (veterans higher)
- 2-4 objectives, alliedObjectivesNeeded = ceil(objectives/2)`;

function buildMapFromZones(zones: ZoneDescriptor[]): Tile[][] {
  const map: Tile[][] = Array.from({ length: 12 }, () =>
    Array.from({ length: 16 }, () => ({ terrain: "open" as TerrainType }))
  );

  const zoneRegions: Record<string, { rows: [number, number]; cols: [number, number] }> = {
    north:  { rows: [0, 3],  cols: [0, 15] },
    south:  { rows: [8, 11], cols: [0, 15] },
    center: { rows: [4, 7],  cols: [4, 11] },
    east:   { rows: [2, 9],  cols: [11, 15] },
    west:   { rows: [2, 9],  cols: [0, 4] },
  };

  for (const zone of zones) {
    const region = zoneRegions[zone.name.toLowerCase()];
    if (!region) continue;
    const [r0, r1] = region.rows;
    const [c0, c1] = region.cols;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        map[r][c] = { terrain: zone.terrain };
      }
    }

    if (zone.features?.includes("road_ew")) {
      const midRow = Math.floor((r0 + r1) / 2);
      for (let c = c0; c <= c1; c++) map[midRow][c] = { terrain: "road" };
    }
    if (zone.features?.includes("road_ns")) {
      const midCol = Math.floor((c0 + c1) / 2);
      for (let r = r0; r <= r1; r++) map[r][midCol] = { terrain: "road" };
    }
  }

  return map;
}

export async function generateTacticalScenario(prompt: string): Promise<ScenarioDefinition> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate a Squad Leader scenario for: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const raw: AIScenarioOutput = JSON.parse(data.choices[0].message.content);

  const map = buildMapFromZones(raw.zones ?? []);

  for (const obj of raw.objectives ?? []) {
    const { row, col } = obj.pos;
    if (map[row]?.[col]) {
      map[row][col] = { ...map[row][col], objective: true, objectiveHeldBy: null };
    }
  }

  return {
    id: "",
    title: raw.title,
    subtitle: raw.subtitle,
    briefing: raw.briefing,
    map,
    units: raw.units,
    objectives: raw.objectives,
    turnsTotal: raw.turnsTotal ?? 10,
    alliedObjectivesNeeded: raw.alliedObjectivesNeeded ?? 2,
    alliedWinCondition: raw.alliedWinCondition,
    axisWinCondition: raw.axisWinCondition,
  };
}
