/**
 * Smoke — Dashboard (authenticated)
 * Verifies the three main tabs render and basic navigation works.
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Dashboard — tab navigation", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
  });

  test("loads Play tab by default", async ({ page }) => {
    // The PLAY pill should be active (blue border)
    const playBtn = page.getByRole("button", { name: /^play$/i });
    await expect(playBtn).toBeVisible();
    // Verify we're showing the play content area
    await expect(page.getByText("PLAY", { exact: true }).first()).toBeVisible();
  });

  test("can switch to Build tab", async ({ dashboard, page }) => {
    await dashboard.switchTo("build");
    // Build tab filter bar contains "BUILD" label
    await expect(page.getByText("BUILD", { exact: true }).first()).toBeVisible();
  });

  test("can switch to Buy tab", async ({ dashboard, page }) => {
    await dashboard.switchTo("buy");
    await expect(page.getByText("BUY", { exact: true }).first()).toBeVisible();
  });

  test("Build tab has category filter dropdown", async ({ dashboard, page }) => {
    await dashboard.switchTo("build");
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("Buy tab has search input", async ({ dashboard, page }) => {
    await dashboard.switchTo("buy");
    await expect(page.getByPlaceholder(/search games/i)).toBeVisible();
  });
});

test.describe("Dashboard — Build tab states", () => {
  test("shows ACTIVE / ARCHIVED toggle", async ({ dashboard, page }) => {
    await dashboard.goto();
    await dashboard.switchTo("build");
    await expect(page.getByRole("button", { name: /active/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /archived/i })).toBeVisible();
  });

  test("can switch to Archived view", async ({ dashboard, page }) => {
    await dashboard.goto();
    await dashboard.switchTo("build");
    await page.getByRole("button", { name: /archived/i }).click();
    // Empty state or table — just ensure no crash
    await expect(page).not.toHaveURL(/error/);
  });
});
