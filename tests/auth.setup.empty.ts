/**
 * Auth setup for the empty-state test user (no games, no credits spent).
 * Logs in with E2E_EMPTY_EMAIL / E2E_EMPTY_PASSWORD and saves storage state
 * to playwright/.auth/empty-user.json.
 *
 * Used by the "chromium-empty" Playwright project to run tests that require
 * an account with no forged games (PL-01, PL-02, PL-03).
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

export const EMPTY_AUTH_FILE = path.join(__dirname, "../playwright/.auth/empty-user.json");

setup("authenticate empty-state user", async ({ page }) => {
  const email = process.env.E2E_EMPTY_EMAIL;
  const password = process.env.E2E_EMPTY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMPTY_EMAIL and E2E_EMPTY_PASSWORD must be set to run empty-state tests."
    );
  }

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder("••••••••").first().fill(password);
  await page.locator("form").getByRole("button", { name: /^sign in$/i }).click();

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: EMPTY_AUTH_FILE });
});
