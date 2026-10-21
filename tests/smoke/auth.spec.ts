/**
 * Smoke — Auth flows
 * Covers: unauthenticated redirect, login form validation, bad-credentials error.
 * These tests do NOT use saved storage state — they run as anonymous users.
 *
 * NOTE: The login form labels have no htmlFor/id association, so we use
 * getByPlaceholder() for inputs instead of getByLabel().
 */

import { test, expect } from "@playwright/test";

// Force anonymous session for all tests in this file,
// overriding any project-level storageState (e.g. playwright/.auth/user.json).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth — unauthenticated access", () => {
  test("dashboard redirects anon user to landing (client-side)", async ({ page }) => {
    await page.goto("/dashboard");
    // Dashboard uses client-side router.replace("/") once NextAuth resolves
    // the session as unauthenticated. Wait for the LOADING... state to clear
    // and the URL to settle on /  (not /login).
    await page.waitForURL(/^\/$/, { timeout: 30_000 });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/);
  });

  test("forge page renders for anon users (no redirect)", async ({ page }) => {
    // /forge does not redirect unauthenticated users — it renders the page
    // and prompts sign-in contextually. Just verify it loads without error.
    const response = await page.goto("/forge");
    expect(response?.status()).not.toBe(500);
    await expect(page).not.toHaveURL(/error/);
  });
});

test.describe("Auth — login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders sign-in form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder("••••••••").first()).toBeVisible();
    // Scope to form to avoid matching the Nav's "Sign In" button
    await expect(page.locator("form").getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("shows error on bad credentials", async ({ page }) => {
    await page.getByPlaceholder(/you@example\.com/i).fill("invalid@example.com");
    await page.getByPlaceholder("••••••••").first().fill("wrongpassword123");
    // Scope to form to avoid matching the Nav's "Sign In" button
    await page.locator("form").getByRole("button", { name: /^sign in$/i }).click();
    // Expect an inline error — not a redirect
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 8_000 });
  });

  test("can switch to create account mode", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/commander shepard/i)).toBeVisible();
    await expect(page.getByPlaceholder("••••••••").nth(1)).toBeVisible(); // confirm password
  });

  test("signup shows error for short password", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await page.getByPlaceholder(/commander shepard/i).fill("Tester");
    await page.getByPlaceholder(/you@example\.com/i).fill("tester@example.com");
    await page.getByPlaceholder("••••••••").first().fill("short");
    await page.getByPlaceholder("••••••••").nth(1).fill("short");
    await page.getByRole("button", { name: /create account/i }).last().click();
    await expect(page.locator("p.text-red-400")).toContainText(/8 characters/i);
  });

  test("signup shows error for mismatched passwords", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await page.getByPlaceholder(/commander shepard/i).fill("Tester");
    await page.getByPlaceholder(/you@example\.com/i).fill("tester@example.com");
    await page.getByPlaceholder("••••••••").first().fill("password123");
    await page.getByPlaceholder("••••••••").nth(1).fill("password456");
    await page.getByRole("button", { name: /create account/i }).last().click();
    await expect(page.locator("p.text-red-400")).toContainText(/do not match/i);
  });
});
