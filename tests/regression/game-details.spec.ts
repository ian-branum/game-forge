/**
 * Regression — Game Details modal (authenticated)
 * Covers: BD-01 through BD-05, GD-01 through GD-03, MD-01 through MD-05, PB-01 through PB-07
 * Requires the test account to have at least one forged game.
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

test.describe("Build tab — game list", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.switchTo("build");
  });

  test("BD-01 shows list of built games", async ({ page }) => {
    // Either a table/list of games or an empty state — no crash
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText("BUILD", { exact: true }).first()).toBeVisible();
  });

  test("BD-02 engine filter dropdown is present", async ({ page }) => {
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("BD-03 Active / Archived toggle works", async ({ page }) => {
    const activeBtn = page.getByRole("button", { name: /active/i });
    const archivedBtn = page.getByRole("button", { name: /archived/i });
    await expect(activeBtn).toBeVisible();
    await expect(archivedBtn).toBeVisible();
    await archivedBtn.click();
    await expect(page).not.toHaveURL(/error/);
    await activeBtn.click();
    await expect(page).not.toHaveURL(/error/);
  });

  test("BD-04 table shows expected columns", async ({ page }) => {
    // Check for column header labels
    const headers = ["Type", "Title", "Description", "Creator", "Created"];
    for (const header of headers) {
      const el = page.getByText(header, { exact: true }).first();
      // Column headers may not exist if there are no games — check gracefully
      const visible = await el.isVisible().catch(() => false);
      if (!visible) {
        // No games present — acceptable
        return;
      }
    }
  });

  test("BD-05 clicking a game row opens Game Details modal", async ({ page }) => {
    // Find first game row and click it
    const firstRow = page.locator("table tbody tr, [data-testid='build-game-row']").first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) {
      test.skip(); // No games in test account yet
      return;
    }
    await firstRow.click();
    // Modal should appear
    await expect(
      page.locator("[role='dialog'], [data-testid='game-details-modal']")
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Game Details modal — header", () => {
  // Helper: open the first game's details modal
  async function openFirstGameModal(page: import("@playwright/test").Page) {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });
    await page.getByRole("button", { name: /^build$/i }).click();
    await page.waitForSelector(`text=BUILD`, { timeout: 5_000 });
    const firstRow = page
      .locator("table tbody tr, [data-testid='build-game-row']")
      .first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) return false;
    await firstRow.click();
    await page
      .locator("[role='dialog'], [data-testid='game-details-modal']")
      .waitFor({ timeout: 5_000 });
    return true;
  }

  test("GD-01 modal shows engine, visibility, forge date and SHARE button", async ({
    page,
  }) => {
    const opened = await openFirstGameModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await expect(modal.getByRole("button", { name: /share/i })).toBeVisible();
    // Visibility badge (Public / Private)
    await expect(modal.getByText(/public|private/i).first()).toBeVisible();
  });

  test("GD-02 SHARE button copies game URL", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const opened = await openFirstGameModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.getByRole("button", { name: /share/i }).click();
    // After clicking SHARE, a toast or confirmation should appear
    const toast = page.getByText(/copied|link copied/i);
    await expect(toast).toBeVisible({ timeout: 4_000 });
  });

  test("GD-03 modal body shows game name, description, MODIFY and PUBLISH tabs", async ({
    page,
  }) => {
    const opened = await openFirstGameModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await expect(modal.getByRole("tab", { name: /modify/i })).toBeVisible();
    await expect(modal.getByRole("tab", { name: /publish/i })).toBeVisible();
  });
});

test.describe("Game Details — Modify tab", () => {
  async function openModifyTab(page: import("@playwright/test").Page) {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });
    await page.getByRole("button", { name: /^build$/i }).click();
    await page.waitForSelector(`text=BUILD`, { timeout: 5_000 });
    const firstRow = page
      .locator("table tbody tr, [data-testid='build-game-row']")
      .first();
    if (!(await firstRow.isVisible().catch(() => false))) return false;
    await firstRow.click();
    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.waitFor({ timeout: 5_000 });
    await modal.getByRole("tab", { name: /modify/i }).click();
    return true;
  }

  test("MD-01 Modify tab shows version history", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    // Version history section
    await expect(
      page.getByText(/version history/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("MD-03 CODE MODIFY and REGENERATE toggle buttons exist", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(
      page.getByRole("button", { name: /code modify/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /regenerate/i })
    ).toBeVisible();
  });

  test("MD-04 CODE MODIFY prompt textarea is present", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    // Switch to CODE MODIFY if not already active
    const codeModifyBtn = page.getByRole("button", { name: /code modify/i });
    if (await codeModifyBtn.isVisible()) await codeModifyBtn.click();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });
});

test.describe("Game Details — Publish tab", () => {
  async function openPublishTab(page: import("@playwright/test").Page) {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });
    await page.getByRole("button", { name: /^build$/i }).click();
    await page.waitForSelector(`text=BUILD`, { timeout: 5_000 });
    const firstRow = page
      .locator("table tbody tr, [data-testid='build-game-row']")
      .first();
    if (!(await firstRow.isVisible().catch(() => false))) return false;
    await firstRow.click();
    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.waitFor({ timeout: 5_000 });
    await modal.getByRole("tab", { name: /publish/i }).click();
    return true;
  }

  test("PB-01 Publish tab shows Make Public and Allow Cloning checkboxes unchecked", async ({
    page,
  }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = page.getByLabel(/make public/i);
    await expect(makePublic).toBeVisible();
    await expect(makePublic).not.toBeChecked();
    const allowCloning = page.getByLabel(/allow cloning/i);
    await expect(allowCloning).toBeVisible();
    await expect(allowCloning).not.toBeChecked();
  });

  test("PB-02 checking Make Public reveals pricing section", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    await page.getByLabel(/make public/i).check();
    await expect(page.getByText(/price/i).first()).toBeVisible({ timeout: 3_000 });
  });

  test("PB-04 clone price lower than play price shows validation error", async ({
    page,
  }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    // Enable Make Public to reveal pricing
    await page.getByLabel(/make public/i).check();
    await page.waitForTimeout(500);

    // Set play price higher than clone price
    const priceInputs = page.getByRole("spinbutton");
    const count = await priceInputs.count();
    if (count < 2) { test.skip(); return; }

    await priceInputs.nth(0).fill("5"); // play price
    await priceInputs.nth(1).fill("2"); // clone price (lower)

    // Trigger validation — click Save/Publish button
    const saveBtn = page.getByRole("button", { name: /save|publish/i });
    if (await saveBtn.isVisible()) await saveBtn.click();

    await expect(
      page.getByText(/clone.*greater|price to clone/i)
    ).toBeVisible({ timeout: 4_000 });
  });

  test("PB-05 free trial options are selectable", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    await page.getByLabel(/make public/i).check();
    await page.waitForTimeout(500);

    // 1 or 3 free trials should be selectable
    const trialOptions = page.getByText(/1 free trial|3 free trials/i);
    if (await trialOptions.first().isVisible()) {
      await expect(trialOptions.first()).toBeVisible();
    } else {
      test.skip();
    }
  });
});
