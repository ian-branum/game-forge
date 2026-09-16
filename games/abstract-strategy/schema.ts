import { z } from "zod";

export const OpponentModeSchema = z.enum(["algorithmic", "llm-opponent"]);

export const AbstractStrategyScenarioSchema = z.object({
  gameId: z.enum(["othello", "chess"]),          // extend as more games added
  title: z.string(),
  description: z.string(),
  opponentMode: OpponentModeSchema,               // "algorithmic" | "llm-opponent"
  // For llm-opponent games, the generator may include opening state or variant rules
  variant: z.string().optional(),                 // e.g. "standard", "chess960"
  aiPersonality: z.string().optional(),           // flavour for LLM prompt e.g. "aggressive", "defensive"
});

export type OpponentMode = z.infer<typeof OpponentModeSchema>;
export type AbstractStrategyScenario = z.infer<typeof AbstractStrategyScenarioSchema>;
