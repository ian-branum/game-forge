/**
 * Regression — Marketplace (authenticated)
 * Verifies the Buy tab marketplace renders, filters, and search work.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Marketplace — Buy tab", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.switchTo("buy");
  });

  test("renders category filter dropdown", async ({ page }) => {
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("renders sort dropdown", async ({ page }) => {
    const selects = page.getByRole("combobox");
    await expect(selects).toHaveCount(2); // category + sort
  });

  test("renders search input", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search games/i);
    await expect(searchInput).toBeVisible();
  });

  test("search input is typeable", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search games/i);
    await searchInput.fill("chess");
    await expect(searchInput).toHaveValue("chess");
  });

  test("changing category filter does not crash page", async ({ page }) => {
    const categorySelect = page.getByRole("combobox").first();
    await categorySelect.selectOption("tactical");
    await page.waitForTimeout(500); // debounce
    await expect(page).not.toHaveURL(/error/);
  });

  test("changing sort does not crash page", async ({ page }) => {
    const sortSelect = page.getByRole("combobox").nth(1);
    await sortSelect.selectOption("popular");
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/error/);
  });
});
