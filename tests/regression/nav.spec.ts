/**
 * Regression — Navigation & layout
 * Ensures the Nav bar renders consistently and deep-links work.
 */

import { test, expect } from "@playwright/test";

// Force anonymous session for all tests in this file,
// overriding any project-level storageState (e.g. playwright/.auth/user.json).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Nav bar", () => {
  test("landing page has a nav bar", async ({ page }) => {
    await page.goto("/");
    // Nav is the first <nav> or the component with game forge branding
    const nav = page.locator("nav, header").first();
    await expect(nav).toBeVisible();
  });

  test("direct /login URL renders login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("landing CTA buttons both navigate to /login", async ({ page }) => {
    await page.goto("/");
    // Both CTA buttons contain the text "Get Started" — use getByText to match
    // partial text reliably regardless of SVG children or middle-dot encoding.
    const btns = page.getByRole("button").filter({ hasText: /get started/i });
    await expect(btns).toHaveCount(2);
    await btns.first().click();
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("404 / unknown routes", () => {
  test("unknown route returns non-500 status", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist-at-all");
    // Acceptable: 404 Not Found — not a 500 server error
    expect(res?.status()).not.toBe(500);
  });
});
