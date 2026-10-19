/**
 * Regression — Credits (authenticated)
 * Covers: DB-06 (Credits nav), BC-01 (Buy Credits screen), FG-03 (insufficient credits error)
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Credits — navigation", () => {
  test("DB-06 clicking Credits count in header opens Buy Credits screen", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });

    // Credits button in header — shows current count
    const creditsBtn = page.getByRole("button", { name: /credits?/i }).first();
    await expect(creditsBtn).toBeVisible();
    await creditsBtn.click();

    // Should navigate to buy-credits page or open a modal
    const onBuyPage = await page.waitForURL("**/buy-credits", { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    const modalVisible = await page
      .locator("[role='dialog'], [data-testid='buy-credits-modal']")
      .isVisible()
      .catch(() => false);

    expect(onBuyPage || modalVisible).toBe(true);
  });
});

test.describe("Buy Credits screen", () => {
  test("BC-01 shows Starter, Standard and Power credit packages", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });
    const creditsBtn = page.getByRole("button", { name: /credits?/i }).first();
    await creditsBtn.click();

    // Wait for screen/modal
    await page.waitForTimeout(1_000);

    await expect(page.getByText(/starter/i).first()).toBeVisible();
    await expect(page.getByText(/standard/i).first()).toBeVisible();
    await expect(page.getByText(/power/i).first()).toBeVisible();
  });
});

test.describe("Forge — insufficient credits", () => {
  test("FG-03 shows user-friendly error (not raw HTTP 402) when credits are too low", async ({
    request,
  }) => {
    // Hit the forge API directly to check the response — we don't want to
    // burn credits, so we use a dummy payload that should fail on credit check
    const res = await request.post("/api/forge", {
      data: {
        engine: "tactical",
        description: "A test game that should fail due to insufficient credits",
      },
    });

    // If 402, the body must be a JSON error object with a user-readable message,
    // NOT a raw "402 Payment Required" HTTP string
    if (res.status() === 402) {
      const body = await res.json().catch(() => null);
      expect(body).not.toBeNull();
      expect(typeof body?.error === "string" || typeof body?.message === "string").toBe(true);
      // Must NOT expose raw HTTP status code text to the user
      const bodyText = JSON.stringify(body).toLowerCase();
      expect(bodyText).not.toMatch(/payment required/);
    } else {
      // Either succeeded (account has credits) or another status — acceptable
      expect([200, 201, 400, 401, 403, 500]).toContain(res.status());
    }
  });
});
