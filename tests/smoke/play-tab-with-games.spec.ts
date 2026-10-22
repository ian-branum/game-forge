/**
 * Smoke — Play Tab: with games (main chromium project)
 * Covers: PL-04, PL-05, PL-08
 *
 * Requires an account that has at least one forged game (E2E_EMAIL).
 * Runs under the standard chromium project.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Play tab — with games", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
  });

  test("PL-04 game cards are shown when account has games", async ({ page }) => {
    // Cards contain a ▶ PLAY link — detect by href prefix
    const playLinks = page.locator('a[href^="/play/"]');
    const count = await playLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("PL-05 engine filter dropdown is present on Play tab", async ({ page }) => {
    const filter = page.getByRole("combobox").first();
    await expect(filter).toBeVisible();
  });

  test("PL-08 Play tab does not enforce a play limit", async ({ page }) => {
    const capsText = page.getByText(/plays? remaining/i);
    await expect(capsText).not.toBeVisible();
  });
});
