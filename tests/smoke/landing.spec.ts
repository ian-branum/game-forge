/**
 * Smoke — Landing Page
 * Verifies the public landing page renders correctly for unauthenticated users.
 * Runs in both Chromium and Mobile Chrome projects.
 */

import { test, expect } from "../../tests/fixtures";

// Force anonymous session — landing page tests must run as a signed-out user.
// Without this, the chromium project's global storageState would keep us logged
// in and the app would redirect to /dashboard instead of showing the landing page.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Landing page", () => {
  test.beforeEach(async ({ landing }) => {
    await landing.goto();
  });

  test("renders hero heading and CTA", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("GAME", { timeout: 10_000 });
    await expect(page.locator("h1")).toContainText("FORGE", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: /get started/i }).first()).toBeVisible();
  });

  test("shows 3 engine cards", async ({ page }) => {
    // Each engine card has a label span visible in the section
    await expect(page.getByText("Games & Puzzles")).toBeVisible();
    await expect(page.getByText("WW2 Tactical")).toBeVisible();
    await expect(page.getByText("Adventure")).toBeVisible();
  });

  test("shows 'How It Works' section with 4 steps", async ({ page }) => {
    // Steps are identified by their zero-padded ordinal
    for (const n of ["01", "02", "03", "04"]) {
      await expect(page.getByText(n)).toBeVisible();
    }
  });

  test("Get Started CTA navigates to /login", async ({ landing }) => {
    await landing.clickGetStarted();
  });

  test("page title is present", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/); // any non-empty title
  });
});
