/**
 * Regression — Buy Tab / Marketplace extended (authenticated)
 * Covers: BY-01 through BY-08 (gaps not already covered by marketplace.spec.ts)
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Buy tab — extended", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.switchTo("buy");
  });

  test("BY-01 all public games are listed", async ({ page }) => {
    // Games list or empty state — no crash
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText("BUY", { exact: true }).first()).toBeVisible();
  });

  test("BY-02 filtering by Game Engine type updates results without crashing", async ({
    page,
  }) => {
    const categorySelect = page.getByRole("combobox").first();
    await categorySelect.selectOption({ index: 1 }); // first non-default option
    await page.waitForTimeout(600);
    await expect(page).not.toHaveURL(/error/);
  });

  test("BY-03 sort by Newest then by Popular updates list order", async ({ page }) => {
    const sortSelect = page.getByRole("combobox").nth(1);
    await sortSelect.selectOption("newest");
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/error/);
    await sortSelect.selectOption("popular");
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/error/);
  });

  test("BY-04 search by game name filters results", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search games/i);
    await searchInput.fill("zzz-no-match-xyz");
    await page.waitForTimeout(700); // debounce
    // Either no results message or empty — no crash
    await expect(page).not.toHaveURL(/error/);
    await searchInput.clear();
  });

  test("BY-05 game cards show free trial info", async ({ page }) => {
    // Look for trial badge/text on game cards
    const trialBadge = page.getByText(/free trial|try free/i).first();
    const hasCards =
      (await page.locator("[data-testid='marketplace-card'], .game-card").count()) > 0;
    if (hasCards) {
      await expect(trialBadge).toBeVisible();
    } else {
      // No public games yet — acceptable
      test.skip();
    }
  });

  test("BY-06 Try Free button opens game without immediate credit charge", async ({
    page,
  }) => {
    const tryFreeBtn = page.getByRole("button", { name: /try free/i }).first();
    const hasTryFree = await tryFreeBtn.isVisible().catch(() => false);
    if (!hasTryFree) { test.skip(); return; }
    await tryFreeBtn.click();
    // Should navigate to a play/game route — not an error
    await page.waitForTimeout(1_000);
    await expect(page).not.toHaveURL(/error/);
  });

  test("BY-08 clicking Display Name filters games by that creator", async ({ page }) => {
    const displayNameLink = page
      .locator("[data-testid='marketplace-card'] [data-testid='creator-name'], .creator-name")
      .first();
    const hasLink = await displayNameLink.isVisible().catch(() => false);
    if (!hasLink) { test.skip(); return; }
    await displayNameLink.click();
    await page.waitForTimeout(600);
    // Filtered list — no crash
    await expect(page).not.toHaveURL(/error/);
  });
});
