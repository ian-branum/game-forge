import { z } from "zod";

export const LogicClueSchema = z.object({
  text: z.string(),
});

export const LogicPuzzleSchema = z.object({
  title: z.string(),
  topic: z.string(),
  intro: z.string(),
  categories: z.tuple([
    z.array(z.string()).length(4),
    z.array(z.string()).length(4),
    z.array(z.string()).length(4),
  ]),
  solution: z.array(z.array(z.number())).length(4),
  clues: z.array(LogicClueSchema),
});

export type LogicClue = z.infer<typeof LogicClueSchema>;
export type LogicPuzzle = z.infer<typeof LogicPuzzleSchema>;
