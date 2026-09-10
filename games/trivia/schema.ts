import { z } from "zod";

export const TriviaQuestionSchema = z.object({
  q: z.string().max(200),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().max(200),
});

export const TriviaScenarioSchema = z.object({
  title: z.string(),
  topic: z.string(),
  questions: z.array(TriviaQuestionSchema).min(1).max(20),
});

export type TriviaQuestion = z.infer<typeof TriviaQuestionSchema>;
export type TriviaScenario = z.infer<typeof TriviaScenarioSchema>;
