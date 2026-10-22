/**
 * Smoke — Play Tab (authenticated, empty-state user)
 * Covers: PL-01 through PL-08
 *
 * PL-01, PL-02, PL-03 require an account with NO games.
 * These run under the "chromium-empty" project (E2E_EMPTY_EMAIL account).
 *
 * PL-04 through PL-08 are account-agnostic — they run under both projects
 * but gracefully handle either state.
 *
 * Uses saved auth state from auth.setup.ts / auth.setup.empty.ts.
 */

import { test, expect } from "../../tests/fixtures";

// ── Empty-state tests (PL-01, PL-02, PL-03) ──────────────────────────────────

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

// ── With-games tests (PL-04 through PL-08) ───────────────────────────────────

test.describe("Play tab — with games", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
  });

  test("PL-04 game cards are shown when account has games", async ({ page }) => {
    // Cards contain a ▶ PLAY link — detect by href prefix
    const playLinks = page.locator('a[href^="/play/"]');
    const emptyState = page.getByRole("button", { name: /build a game/i });
    const hasCards = (await playLinks.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
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
