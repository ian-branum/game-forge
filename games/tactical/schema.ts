import { z } from "zod";

export const TerrainTypeSchema = z.enum([
  "open", "road", "woods", "building", "rubble", "wall", "wheatfield"
]);

export const FactionSchema = z.enum(["allied", "axis"]);

export const UnitTypeSchema = z.enum(["infantry", "leader", "mg", "mortar", "vehicle"]);

export const PosSchema = z.object({
  row: z.number().int(),
  col: z.number().int(),
});

export const TileSchema = z.object({
  terrain: TerrainTypeSchema,
  objective: z.boolean().optional(),
  objectiveHeldBy: FactionSchema.nullable().optional(),
});

export const UnitDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  faction: FactionSchema,
  type: UnitTypeSchema,
  attack: z.number(),
  defense: z.number(),
  movement: z.number(),
  range: z.number(),
  morale: z.number(),
  pos: PosSchema,
  emoji: z.string(),
});

export const ScenarioDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  briefing: z.string(),
  map: z.array(z.array(TileSchema)),
  units: z.array(UnitDefinitionSchema),
  objectives: z.array(z.object({ pos: PosSchema, label: z.string() })),
  turnsTotal: z.number().int(),
  alliedObjectivesNeeded: z.number().int(),
  alliedWinCondition: z.string(),
  axisWinCondition: z.string(),
});

export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;
