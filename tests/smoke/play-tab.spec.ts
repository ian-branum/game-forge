/**
 * Smoke — Play Tab: empty state (chromium-empty project only)
 * Covers: PL-01, PL-02, PL-03
 *
 * Requires an account with NO games (E2E_EMPTY_EMAIL).
 * Excluded from the main chromium project via testIgnore in playwright.config.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Play tab — empty state", () => {
  test("PL-01 shows build and browse options when no games exist", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await expect(page.getByRole("button", { name: /build a game/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /browse marketplace/i })).toBeVisible();
  });

  test("PL-02 Build a Game button switches to Build tab", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await page.getByRole("button", { name: /build a game/i }).click();
    await expect(page.getByText("BUILD", { exact: true }).first()).toBeVisible();
  });

  test("PL-03 Browse Marketplace button switches to Buy tab", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await page.getByRole("button", { name: /browse marketplace/i }).click();
    await expect(page.getByText("BUY", { exact: true }).first()).toBeVisible();
  });
});
