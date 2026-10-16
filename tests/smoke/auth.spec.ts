/**
 * Smoke — Auth flows
 * Covers: unauthenticated redirect, login form validation, bad-credentials error.
 * These tests do NOT use saved storage state — they run as anonymous users.
 */

import { test, expect } from "@playwright/test";

test.describe("Auth — unauthenticated redirects", () => {
  test("dashboard redirects anon user to landing", async ({ page }) => {
    await page.goto("/dashboard");
    // Should end up at / (landing) — not dashboard
    await page.waitForURL(/^\/$|\/login/, { timeout: 10_000 });
    const url = page.url();
    expect(url).not.toContain("/dashboard");
  });

  test("forge page redirects anon user", async ({ page }) => {
    await page.goto("/forge");
    await page.waitForURL(/^\/$|\/login/, { timeout: 10_000 });
    const url = page.url();
    expect(url).not.toContain("/forge");
  });
});

test.describe("Auth — login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders sign-in form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("shows error on bad credentials", async ({ page }) => {
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/^password$/i).fill("wrongpassword123");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    // Expect an inline error — not a redirect
    await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 8_000 });
  });

  test("can switch to create account mode", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
  });

  test("signup shows error for short password", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await page.getByLabel(/display name/i).fill("Tester");
    await page.getByLabel(/email/i).fill("tester@example.com");
    await page.getByLabel(/^password$/i).fill("short");
    await page.getByLabel(/confirm password/i).fill("short");
    await page.getByRole("button", { name: /create account/i }).last().click();
    await expect(page.locator("p.text-red-400")).toContainText(/8 characters/i);
  });

  test("signup shows error for mismatched passwords", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await page.getByLabel(/display name/i).fill("Tester");
    await page.getByLabel(/email/i).fill("tester@example.com");
    await page.getByLabel(/^password$/i).fill("password123");
    await page.getByLabel(/confirm password/i).fill("password456");
    await page.getByRole("button", { name: /create account/i }).last().click();
    await expect(page.locator("p.text-red-400")).toContainText(/do not match/i);
  });
});
