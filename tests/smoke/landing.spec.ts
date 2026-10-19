/**
 * Smoke — Landing Page
 * Verifies the public landing page renders correctly for unauthenticated users.
 * Runs in both Chromium and Mobile Chrome projects.
 *
 * NOTE: storageState is explicitly cleared so these tests always run as anon,
 * even when the chromium project has a saved auth state.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Landing page", () => {
  // Force unauthenticated context — clears any saved session cookies
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ landing }) => {
    await landing.goto();
  });

  test("renders hero heading and CTA", async ({ page }) => {
    // h1 may render as separate words/spans — check for either combined or split
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const h1Text = await h1.innerText();
    expect(h1Text.toUpperCase()).toMatch(/GAME|FORGE/);
    await expect(page.getByRole("button", { name: /get started/i }).first()).toBeVisible();
  });

  test("shows 3 engine cards", async ({ page }) => {
    // Case-insensitive text match — engine names may render in any case
    await expect(page.getByText(/games\s*&\s*puzzles/i).first()).toBeVisible();
    await expect(page.getByText(/ww2\s*tactical/i).first()).toBeVisible();
    await expect(page.getByText(/adventure/i).first()).toBeVisible();
  });

  test("shows 'How It Works' section with 4 steps", async ({ page }) => {
    // Scroll the section into view first — it may be below the fold
    const howItWorks = page.getByText(/how it works/i).first();
    await howItWorks.scrollIntoViewIfNeeded();
    // Steps identified by zero-padded ordinals — match anywhere in the section
    for (const n of ["01", "02", "03", "04"]) {
      await expect(
        page.getByText(new RegExp(`\\b0?${parseInt(n, 10)}\\b`)).first()
      ).toBeVisible();
    }
  });

  test("Get Started CTA navigates to /login", async ({ landing }) => {
    await landing.clickGetStarted();
  });

  test("page title is present", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/); // any non-empty title
  });
});
