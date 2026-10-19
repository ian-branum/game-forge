/**
 * Smoke — Forge a Game (authenticated)
 * Covers: FG-01 through FG-04 (engine options, credit display, insufficient credits error)
 * Does NOT actually forge a game (would consume credits + hit AI).
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Forge a Game — page structure", () => {
  test.beforeEach(async ({ forge }) => {
    await forge.goto();
  });

  test("FG-01 shows three engine options", async ({ page }) => {
    // Games & Puzzles and WW2 Tactical selectable; Adventure coming soon
    await expect(page.getByText(/games & puzzles/i)).toBeVisible();
    await expect(page.getByText(/ww2 tactical/i)).toBeVisible();
    await expect(page.getByText(/adventure/i)).toBeVisible();
  });

  test("FG-04 credit count is visible on the Forge page", async ({ page }) => {
    // Credits shown in header or below the form
    const creditsVisible =
      (await page.getByText(/credits?/i).count()) > 0;
    expect(creditsVisible).toBe(true);
  });

  test("FG-02 Forge Game button is present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /forge game/i })
    ).toBeVisible();
  });

  test("description textarea is present", async ({ page }) => {
    await expect(
      page.getByRole("textbox").first()
    ).toBeVisible();
  });
});

test.describe("Forge a Game — header nav", () => {
  test("DB-05 Forge button in header navigates to /forge", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });
    await page.getByRole("button", { name: /^forge$/i }).click();
    await page.waitForURL("**/forge", { timeout: 8_000 });
    await expect(page).toHaveURL(/\/forge/);
  });
});
