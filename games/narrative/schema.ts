import { z } from "zod";

export const NarrativeChoiceSchema = z.object({
  text: z.string().max(100),
  outcome: z.string().max(200),
  nextScene: z.number().int(),
  isGood: z.boolean().optional(),
});

export const NarrativeSceneSchema = z.object({
  id: z.number().int(),
  text: z.string().max(500),
  choices: z.array(NarrativeChoiceSchema),
  isEnd: z.boolean().optional(),
  endType: z.enum(["victory", "defeat", "neutral"]).optional(),
});

export const NarrativeScenarioSchema = z.object({
  title: z.string(),
  genre: z.string(),
  opening: z.string().max(400),
  scenes: z.array(NarrativeSceneSchema).min(1),
});

export type NarrativeChoice = z.infer<typeof NarrativeChoiceSchema>;
export type NarrativeScene = z.infer<typeof NarrativeSceneSchema>;
export type NarrativeScenario = z.infer<typeof NarrativeScenarioSchema>;
