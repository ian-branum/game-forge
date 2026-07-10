import type { ScenarioDefinition, Tile, TerrainType } from "../types";

function t(terrain: TerrainType, objective?: boolean): Tile {
  return { terrain, ...(objective ? { objective: true, objectiveHeldBy: null } : {}) };
}

// 12 rows × 16 cols
// Layout:
//   rows 0-2: woods (NW), open fields
//   row 5: east-west road + stone wall below it
//   rows 4-7: building clusters (village center/right)
//   rows 9-11: wheatfields, allied start (SW)
//   col 0-3: woods (ally approach)
//   col 8-14: buildings / rubble (village)

const map: Tile[][] = [
  // row 0 — north edge: mix of woods and open
  [t("woods"),t("woods"),t("woods"),t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open")],
  // row 1
  [t("woods"),t("woods"),t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("building"),t("open"), t("open")],
  // row 2
  [t("woods"),t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open")],
  // row 3
  [t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open")],
  // row 4 — upper village buildings
  [t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("building"),t("building"),t("open"), t("open")],
  // row 5 — road + wall + village center (with farmhouse objective)
  [t("wall"), t("wall"), t("wall"), t("wall"), t("wall"), t("road"), t("road"), t("road"), t("road"), t("building", true),t("road"), t("building"),t("building"),t("open"), t("open"), t("open")],
  // row 6 — road continues, building cluster south
  [t("open"), t("open"), t("open"), t("open"), t("road"), t("road"), t("road"), t("road"), t("open"), t("open"), t("open"), t("building"),t("open"), t("open"), t("building", true),t("open")],
  // row 7 — rubble from damaged buildings
  [t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("rubble"),t("rubble"),t("open"), t("open"), t("building"),t("open"), t("open"), t("open")],
  // row 8 — open fields, dangerous crossing
  [t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("open"), t("building", true),t("open"), t("open"), t("woods")],
  // row 9 — wheatfield + allied start
  [t("wheatfield"),t("wheatfield"),t("wheatfield"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("woods"),t("woods")],
  // row 10 — wheatfield + allied units
  [t("wheatfield"),t("wheatfield"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("woods"),t("woods")],
  // row 11 — south edge: wheatfields
  [t("wheatfield"),t("wheatfield"),t("wheatfield"),t("wheatfield"),t("wheatfield"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("open"),t("woods"),t("woods")],
];

export const normandyScenario: ScenarioDefinition = {
  id: "normandy",
  title: "Normandy, France (Squad Leader)",
  subtitle: "Clear the Village — June 6, 1944",
  briefing: `Intelligence reports a small German garrison holding the village of Sainte-Croix-sur-Mer. Three key positions must be cleared before dawn: the Farmhouse crossroads, the Church on the hill, and the Mayor's House at the south road.

Your men of the 101st Airborne have been scattered by a rough drop, but those who gathered are ready for action. Move through the wheatfields and woods for cover, then push into the village hard and fast. The Germans are dug in and well-armed — their MG42 team will chew through anyone caught in the open.

You have 10 turns before reinforcements arrive and the window closes.

Fight smart. Fight hard. Clear the village.`,

  map,

  units: [
    // Allied — 101st Airborne (bottom-left)
    { id: "a1", name: "1st Squad",    faction: "allied", type: "infantry", attack: 4, defense: 2, movement: 4, range: 4, morale: 8, pos: { row: 10, col: 0 }, emoji: "🪖" },
    { id: "a2", name: "2nd Squad",    faction: "allied", type: "infantry", attack: 4, defense: 2, movement: 4, range: 4, morale: 8, pos: { row: 11, col: 1 }, emoji: "🪖" },
    { id: "a3", name: "3rd Squad",    faction: "allied", type: "infantry", attack: 4, defense: 2, movement: 4, range: 4, morale: 7, pos: { row: 9,  col: 0 }, emoji: "🪖" },
    { id: "a4", name: "Lt. Miller",   faction: "allied", type: "leader",   attack: 3, defense: 2, movement: 5, range: 3, morale: 9, pos: { row: 10, col: 1 }, emoji: "⭐" },
    { id: "a5", name: "BAR Team",     faction: "allied", type: "mg",       attack: 6, defense: 2, movement: 3, range: 6, morale: 8, pos: { row: 11, col: 0 }, emoji: "🔫" },

    // Axis — German garrison (village center/right)
    { id: "g1", name: "1st Gruppe",        faction: "axis", type: "infantry", attack: 4, defense: 3, movement: 3, range: 4, morale: 7, pos: { row: 5,  col: 9  }, emoji: "🎖️" },
    { id: "g2", name: "2nd Gruppe",        faction: "axis", type: "infantry", attack: 4, defense: 3, movement: 3, range: 4, morale: 7, pos: { row: 6,  col: 11 }, emoji: "🎖️" },
    { id: "g3", name: "3rd Gruppe",        faction: "axis", type: "infantry", attack: 4, defense: 3, movement: 3, range: 4, morale: 6, pos: { row: 4,  col: 13 }, emoji: "🎖️" },
    { id: "g4", name: "MG42 Team",         faction: "axis", type: "mg",       attack: 7, defense: 3, movement: 2, range: 7, morale: 8, pos: { row: 5,  col: 12 }, emoji: "💀" },
    { id: "g5", name: "Feldwebel Krause",  faction: "axis", type: "leader",   attack: 3, defense: 3, movement: 3, range: 3, morale: 9, pos: { row: 5,  col: 11 }, emoji: "🎖️" },
  ],

  objectives: [
    { pos: { row: 5, col: 9  }, label: "Farmhouse" },
    { pos: { row: 4, col: 12 }, label: "Church" },
    { pos: { row: 6, col: 14 }, label: "Mayor's House" },
  ],

  turnsTotal: 10,
  alliedObjectivesNeeded: 2,
  alliedWinCondition: "The Airborne clears the village before dawn. Mission accomplished.",
  axisWinCondition: "The German defenders hold long enough. Reinforcements are coming.",
};
