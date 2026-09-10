import { z } from "zod";

export const WordPuzzleSchema = z.object({
  title: z.string(),
  topic: z.string(),
  words: z.array(z.string()).min(1).max(10),
  grid: z.array(z.array(z.string().length(1))).length(12),
  clues: z.array(z.string()),
});

export type WordPuzzle = z.infer<typeof WordPuzzleSchema>;
