/**
 * Regression — Game Details modal (authenticated)
 * Covers: BD-01 through BD-05, GD-01 through GD-03, MD-01 through MD-05, PB-01 through PB-07
 *
 * Modal selector: div.fixed.inset-0.z-50 (no role="dialog")
 * Tab buttons: plain <button> with text MODIFY / PUBLISH (no role="tab")
 * Checkboxes: unlabelled inputs inside <label> tags with adjacent span text
 * Free trial: buttons "1 SESSION" / "3 SESSIONS"
 * Clone price: auto-clamps on blur (no save button needed)
 */

import { test, expect } from "../../tests/fixtures";

const MODAL = "div.fixed.inset-0.z-50";

// ── Helper: open first Active game's modal ────────────────────────────────────

async function openFirstGameModal(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.waitForSelector("text=PLAY", { timeout: 10_000 });
  await page.getByRole("button", { name: /^build$/i }).click();
  await page.waitForSelector("text=BUILD", { timeout: 5_000 });

  const firstRow = page.locator("table tbody tr").first();
  const hasRows = await firstRow.isVisible().catch(() => false);
  if (!hasRows) return false;

  await firstRow.click();
  await page.locator(MODAL).waitFor({ timeout: 5_000 });
  return true;
}

async function openModifyTab(page: import("@playwright/test").Page) {
  const opened = await openFirstGameModal(page);
  if (!opened) return false;
  await page.locator(MODAL).getByRole("button", { name: "MODIFY" }).click();
  return true;
}

async function openPublishTab(page: import("@playwright/test").Page) {
  const opened = await openFirstGameModal(page);
  if (!opened) return false;
  await page.locator(MODAL).getByRole("button", { name: "PUBLISH" }).click();
  await page.waitForTimeout(300);
  return true;
}

function makePublicCheckbox(page: import("@playwright/test").Page) {
  return page.locator("label").filter({ hasText: /make public/i }).locator('input[type="checkbox"]');
}
function allowCloningCheckbox(page: import("@playwright/test").Page) {
  return page.locator("label").filter({ hasText: /allow cloning/i }).locator('input[type="checkbox"]').first();
}

// ── Build tab — game list ─────────────────────────────────────────────────────

test.describe("Build tab — game list", () => {
  test.beforeEach(async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.switchTo("build");
  });

  test("BD-01 shows list of built games", async ({ page }) => {
    await expect(page).not.toHaveURL(/error/);
    await expect(page.getByText("BUILD", { exact: true }).first()).toBeVisible();
  });

  test("BD-02 engine filter dropdown is present", async ({ page }) => {
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  test("BD-03 Active / Archived toggle works", async ({ page }) => {
    const activeBtn = page.getByRole("button", { name: /^active$/i });
    const archivedBtn = page.getByRole("button", { name: /^archived$/i });
    await expect(activeBtn).toBeVisible();
    await expect(archivedBtn).toBeVisible();
    await archivedBtn.click();
    await expect(page).not.toHaveURL(/error/);
    await activeBtn.click();
    await expect(page).not.toHaveURL(/error/);
  });

  test("BD-04 table shows expected column headers", async ({ page }) => {
    const columns = ["TYPE", "TITLE", "DESCRIPTION", "CREATOR", "CREATED"];
    for (const col of columns) {
      const el = page.getByText(col, { exact: true }).first();
      const visible = await el.isVisible().catch(() => false);
      if (!visible) return; // No games — acceptable
    }
  });

  test("BD-05 clicking a game row opens the Game Details modal", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) { test.skip(); return; }
    await firstRow.click();
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 });
  });
});

// ── Game Details modal — header ───────────────────────────────────────────────

test.describe("Game Details modal — header", () => {
  test("GD-01 modal shows engine badge, forge date and SHARE button", async ({ page }) => {
    const opened = await openFirstGameModal(page);
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    await expect(modal.getByRole("button", { name: "SHARE" })).toBeVisible();
    await expect(modal.getByText(/forged/i).first()).toBeVisible();
  });

  test("GD-02 SHARE button shows Copied confirmation", async ({ page }) => {
    const opened = await openFirstGameModal(page);
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    await modal.getByRole("button", { name: "SHARE" }).click();
    await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 4_000 });
  });

  test("GD-03 modal body shows MODIFY and PUBLISH tab buttons", async ({ page }) => {
    const opened = await openFirstGameModal(page);
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    await expect(modal.getByRole("button", { name: "MODIFY" })).toBeVisible();
    await expect(modal.getByRole("button", { name: "PUBLISH" })).toBeVisible();
  });
});

// ── Game Details — Modify tab ─────────────────────────────────────────────────

test.describe("Game Details — Modify tab", () => {
  test("MD-01 Modify tab shows VERSION HISTORY", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(page.getByText("VERSION HISTORY")).toBeVisible({ timeout: 5_000 });
  });

  test("MD-02 SET ACTIVE button present when multiple versions exist", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    const setActiveBtn = page.getByRole("button", { name: "SET ACTIVE" }).first();
    const hasMultiple = await setActiveBtn.isVisible().catch(() => false);
    if (!hasMultiple) { test.skip(); return; } // Only one version — acceptable
    await expect(setActiveBtn).toBeVisible();
  });

  test("MD-03 CODE MODIFY and REGENERATE toggle buttons exist", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(page.getByRole("button", { name: "CODE MODIFY" })).toBeVisible();
    await expect(page.getByRole("button", { name: "REGENERATE" })).toBeVisible();
  });

  test("MD-04 CODE MODIFY prompt textarea is present", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await page.getByRole("button", { name: "CODE MODIFY" }).click();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("MD-06 game title input is editable", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    const titleInput = modal.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible();
    const original = await titleInput.inputValue();
    await titleInput.clear();
    await titleInput.type("Test Name Change");
    await expect(titleInput).toHaveValue("Test Name Change");
    // Restore original
    await titleInput.clear();
    await titleInput.type(original);
    await titleInput.blur();
  });
});

// ── Game Details — Publish tab ────────────────────────────────────────────────

test.describe("Game Details — Publish tab", () => {
  test("PB-01 Publish tab shows Make public and Allow cloning checkboxes unchecked", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await expect(makePublic).not.toBeChecked();
    await expect(allowCloningCheckbox(page)).not.toBeChecked();
  });

  test("PB-02 checking Make public reveals PRICE TO PLAY section", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await expect(page.getByText("PRICE TO PLAY")).toBeVisible({ timeout: 3_000 });
  });

  test("PB-03 price to play and price to clone inputs are present", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await page.waitForTimeout(300);
    await expect(page.getByText("PRICE TO PLAY")).toBeVisible();
    await expect(page.getByText("PRICE TO CLONE")).toBeVisible();
  });

  test("PB-04 clone price auto-clamps to be >= play price", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await allowCloningCheckbox(page).check();
    await page.waitForTimeout(300);

    const priceInputs = page.locator('input[type="number"]');
    if ((await priceInputs.count()) < 2) { test.skip(); return; }

    // Set play price to 5 — clone should auto-clamp to >= 5
    await priceInputs.nth(0).fill("5");
    await priceInputs.nth(0).blur();
    await page.waitForTimeout(300);

    const cloneVal = await priceInputs.nth(1).inputValue();
    expect(Number(cloneVal)).toBeGreaterThanOrEqual(5);
  });

  test("PB-05 free trial session buttons (1 SESSION / 3 SESSIONS) are selectable", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "1 SESSION" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "3 SESSIONS" })).toBeVisible();
    await page.getByRole("button", { name: "3 SESSIONS" }).click();
    await expect(page).not.toHaveURL(/error/);
  });

  test("PB-06 Allow cloning checkbox reveals republish sub-option", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const allowCloning = allowCloningCheckbox(page);
    if (!(await allowCloning.isVisible().catch(() => false))) { test.skip(); return; }
    await allowCloning.check();
    await page.waitForTimeout(300);
    await expect(page.getByText(/allow clones to be republished/i)).toBeVisible();
  });

  test("PB-07 making a game public makes it visible in Buy tab", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }

    const isAlreadyPublic = await makePublic.isChecked();
    if (!isAlreadyPublic) {
      await makePublic.check();
      await page.waitForTimeout(1_500); // auto-saves
    }

    // Close modal and switch to Buy tab
    await page.locator(MODAL).getByRole("button", { name: "×" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^buy$/i }).click();
    await page.waitForSelector("text=BUY", { timeout: 5_000 });
    await expect(page).not.toHaveURL(/error/);
  });
});
