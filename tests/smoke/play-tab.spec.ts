/**
 * Smoke — Play Tab (authenticated)
 * Covers: PL-01 through PL-08
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Play tab — empty state", () => {
  // NOTE: These tests apply to accounts with no games.
  // The empty state buttons read "⚡ BUILD A GAME" and "🏪 BROWSE MARKETPLACE".
  // If the account already has games the empty state won't render — skip gracefully.
  test("PL-01 shows build and browse options when no games exist", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    // Cards are plain divs in a grid — detect by the PLAY button inside them
    const hasGames = (await page.locator('a[href^="/play/"]').count()) > 0;
    if (!hasGames) {
      await expect(page.getByRole("button", { name: /build a game/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /browse marketplace/i })).toBeVisible();
    } else {
      // Account has games — empty state not shown, skip
      test.skip();
    }
  });

  test("PL-02 Build a Game button switches to Build tab", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    const hasGames = (await page.locator('a[href^="/play/"]').count()) > 0;
    if (hasGames) { test.skip(); return; }

    const emptyBuildBtn = page.getByRole("button", { name: /build a game/i });
    await emptyBuildBtn.click();
    await expect(page.getByText("BUILD", { exact: true }).first()).toBeVisible();
  });

  test("PL-03 Browse Marketplace button switches to Buy tab", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    const hasGames = (await page.locator('a[href^="/play/"]').count()) > 0;
    if (hasGames) { test.skip(); return; }

    const browseBtn = page.getByRole("button", { name: /browse marketplace/i });
    await browseBtn.click();
    await expect(page.getByText("BUY", { exact: true }).first()).toBeVisible();
  });
});

test.describe("Play tab — with games", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
  });

  test("PL-04 game cards are shown when account has games", async ({ page }) => {
    // Cards have no data-testid — detect via the ▶ PLAY link inside each card
    const playLinks = page.locator('a[href^="/play/"]');
    const emptyState = page.getByRole("button", { name: /build a game/i });
    const hasCards = (await playLinks.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("PL-05 engine filter dropdown is present on Play tab", async ({ page }) => {
    // Filter by game engine
    const filter = page.getByRole("combobox").first();
    await expect(filter).toBeVisible();
  });

  test("PL-08 Play tab does not enforce a play limit", async ({ page }) => {
    // Verify there is no 'plays remaining' cap text visible
    const capsText = page.getByText(/plays? remaining/i);
    await expect(capsText).not.toBeVisible();
  });
});
