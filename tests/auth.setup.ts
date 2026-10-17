/**
 * Global auth setup — runs once before all test projects that depend on it.
 * Logs in with email/password and saves browser storage state to
 * playwright/.auth/user.json so all subsequent tests start authenticated.
 *
 * Credentials come from env vars (never hard-coded):
 *   E2E_EMAIL     — test account email
 *   E2E_PASSWORD  — test account password
 *
 * NOTE: The login form labels have no htmlFor/id association, so we use
 * getByPlaceholder() for inputs instead of getByLabel().
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD must be set to run authenticated tests.\n" +
        "Create a dedicated test account on game-forge.ai and export those vars."
    );
  }

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  // Fill email + password and submit
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder("••••••••").first().fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // Persist the authenticated session
  await page.context().storageState({ path: AUTH_FILE });
});
