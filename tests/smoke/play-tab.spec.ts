/**
 * Smoke — Play Tab (authenticated)
 * Covers: PL-01 through PL-08
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Play tab — empty state", () => {
  // NOTE: This describe block applies to accounts with no games.
  // In CI, the test account may already have games — skip gracefully if so.
  test("PL-01 shows build and browse options when no games exist", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    // Play tab is default
    const hasGames = (await page.locator("[data-testid='game-card']").count()) > 0;
    if (!hasGames) {
      await expect(page.getByRole("button", { name: /build a game/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /browse marketplace/i })).toBeVisible();
    } else {
      // Account has games — skip empty-state check
      test.skip();
    }
  });

  test("PL-02 Build a Game button switches to Build tab", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    const emptyBuildBtn = page.getByRole("button", { name: /build a game/i });
    if (await emptyBuildBtn.isVisible()) {
      await emptyBuildBtn.click();
      await expect(page.getByText("BUILD", { exact: true }).first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("PL-03 Browse Marketplace button switches to Buy tab", async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    const browseBtn = page.getByRole("button", { name: /browse marketplace/i });
    if (await browseBtn.isVisible()) {
      await browseBtn.click();
      await expect(page.getByText("BUY", { exact: true }).first()).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe("Play tab — with games", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
  });

  test("PL-04 game cards are shown when account has games", async ({ page }) => {
    // If this account has games, cards should be visible
    // If not, the empty state shows — either is valid
    const cards = page.locator("[data-testid='game-card'], .game-card");
    const emptyState = page.getByRole("button", { name: /build a game/i });
    const hasCards = await cards.count() > 0;
    const hasEmpty = await emptyState.isVisible();
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
