/**
 * Smoke — Landing Page
 * Covers the public landing page for anonymous users.
 */

import { test, expect } from "@playwright/test";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders hero heading and CTA", async ({ page }) => {
    await expect(page.locator("h1").first()).toContainText(/GAME/i);
    await expect(page.locator("h1").first()).toContainText(/FORGE/i);

    await expect(
      page.getByRole("button", { name: /get started/i }).first()
    ).toBeVisible();
  });

  test("shows all 3 engine cards", async ({ page }) => {
    for (const name of [
      "Games & Puzzles",
      "WW2 Tactical",
      "Adventure",
    ]) {
      const visibleText = page
        .getByText(name, { exact: true })
        .and(page.locator(":visible"));

      await expect(visibleText.first()).toBeVisible();
    }
  });

  test("shows How It Works with all 4 steps", async ({ page }) => {
    for (const number of ["01", "02", "03", "04"]) {
      const visibleNumber = page
        .getByText(number, { exact: true })
        .and(page.locator(":visible"));

      await expect(visibleNumber.first()).toBeVisible();
    }
  });

  test("Get Started navigates to login", async ({ page }) => {
    const getStarted = page
      .getByRole("button", { name: /get started/i })
      .first();

    await expect(getStarted).toBeVisible();
    await getStarted.click();

    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  });

  test("has a page title", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });
});
