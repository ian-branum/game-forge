import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "fs";

// Load .env.local if present (Next.js convention — not auto-loaded by Playwright)
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

/**
 * Game-Forge Playwright config.
 *
 * Target: Preview / production URL (game-forge.ai).
 * Auth state: stored in playwright/.auth/user.json — generated once by
 * the "setup" project and reused by all test projects.
 *
 * Local usage:
 *   npx playwright test               # all tests (Chromium)
 *   npx playwright test --project=chromium
 *   npx playwright test smoke/        # smoke suite only
 *   BASE_URL=http://localhost:3000 npx playwright test  # against local dev
 *
 * CI usage (set env vars):
 *   BASE_URL, E2E_EMAIL, E2E_PASSWORD
 */

const BASE_URL = process.env.BASE_URL ?? "https://preview.game-forge.ai";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./playwright-report/results",

  /* Retry flaky tests once in CI */
  retries: process.env.CI ? 1 : 0,

  /* Run tests in parallel (file-level) */
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  /* Reporters */
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/html", open: "never" }],
  ],

  /* Shared settings for every test */
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
    // Bypass Vercel Deployment Protection on Preview.
    // Set VERCEL_AUTOMATION_BYPASS_SECRET in your env (never commit this value).
    // Generate it in: Vercel Dashboard → Project → Settings → Deployment Protection
    //                 → Protection Bypass for Automation
    // This header is ignored by Prod — safe to always include.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : {},
  },

  projects: [
    /* ── Global setup: log in once and save storage state ── */
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    /* ── Empty-state setup: log in as a user with no games ── */
    {
      name: "setup-empty",
      testMatch: "**/auth.setup.empty.ts",
    },

    /* ── Chromium (primary) — authenticated ── */
    {
      name: "chromium",
      // play-tab.spec.ts is owned by chromium-empty (requires a no-games account)
      testIgnore: "**/smoke/play-tab.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    /* ── Firefox ── (disabled by default; uncomment to enable) */
    // {
    //   name: "firefox",
    //   use: {
    //     ...devices["Desktop Firefox"],
    //     storageState: "playwright/.auth/user.json",
    //   },
    //   dependencies: ["setup"],
    // },

    /* ── Chromium (empty-state user) — no games in account ── */
    {
      name: "chromium-empty",
      testMatch: "**/smoke/play-tab.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/empty-user.json",
      },
      dependencies: ["setup-empty"],
    },

    /* ── Mobile Chrome — unauthenticated (landing + login only) ── */
    {
      name: "mobile-chrome",
      testMatch: "**/smoke/landing.spec.ts",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
