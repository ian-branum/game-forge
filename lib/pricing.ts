/**
 * lib/pricing.ts
 * Central configuration for credit costs and operational parameters.
 * Change values here — no code changes needed elsewhere.
 */

// ── Credit costs by operation and game type ───────────────────────────────────

export const CREDIT_COSTS = {
  /** Forge: generate a brand-new scenario from a prompt */
  forge: {
    sandbox:   3,
    tactical:  3,
    narrative: 4,
  },

  /**
   * Regenerate: discard existing code, re-run the generator with the full
   * prompt chain (original + all modify prompts). Use when the game is broken.
   */
  regenerate: {
    sandbox:   3,   // matches forge
    tactical:  3,   // matches forge
    narrative: 4,   // matches forge
  },

  /**
   * Code Modify: send the existing code + a new instruction to the generator.
   * Cheaper than a full regenerate. Use for targeted tweaks.
   */
  codeModify: {
    sandbox:   3,   // matches forge
    tactical:  3,   // matches forge
    narrative: 4,   // matches forge
  },
} as const;

export type GameCategory = keyof (typeof CREDIT_COSTS)["forge"];

/** Look up a cost; falls back to forge cost if category is unknown. */
export function getCost(
  op: keyof typeof CREDIT_COSTS,
  category: string
): number {
  const table = CREDIT_COSTS[op];
  return (table as Record<string, number>)[category] ?? CREDIT_COSTS.forge.sandbox;
}

// ── Freemium / marketplace defaults ──────────────────────────────────────────

export const FREEMIUM = {
  creditsOnSignup:          3,
  freePlayLimitDefault:     1,   // sessions before a license is required
  maxFreeTrialsPerScenario: 3,   // total across all users
  freeFixesPerDay:          3,   // max free "broken game" fixes per user per 24h
} as const;

// ── Generation limits ─────────────────────────────────────────────────────────

export const LIMITS = {
  maxVersionsPerScenario: 10,
  maxModifyPromptLength:  1000,
  maxForgesPerHour:       5,
} as const;

// ── AI model routing ──────────────────────────────────────────────────────────
// Swap cheaply here without touching generator files.

export const MODELS = {
  forge:      "deepseek-v4-flash",
  regenerate: "deepseek-v4-flash",
  codeModify: "deepseek-v4-flash",
} as const;
