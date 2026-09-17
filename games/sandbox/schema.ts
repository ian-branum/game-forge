import { z } from "zod";

export const SandboxScenarioSchema = z.object({
  title: z.string(),
  description: z.string(),
  html: z.string().min(100), // The full self-contained game HTML
});

export type SandboxScenario = z.infer<typeof SandboxScenarioSchema>;
