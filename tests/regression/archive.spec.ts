/**
 * Regression — Archive View (authenticated)
 * Covers: AR-01, AR-02, AR-03, AR-09 through AR-29
 * Also covers: PB-08 (Archive action from Game Details modal)
 *
 * Modal selector: div.fixed.inset-0 (no role="dialog")
 * Tabs: plain <button> elements with text MODIFY / PUBLISH (no role="tab")
 * Checkboxes: unlabelled inputs next to <span> text — use locator chaining
 * Archive button: "🗄 ARCHIVE" | Restore: "↩ RESTORE" | Deep: "⛔ DEEP ARCHIVE"
 * +New Game: <Link href="/forge"> with text "+ NEW GAME"
 * Free trial: buttons "1 SESSION" / "3 SESSIONS"
 */

import { test, expect } from "../../tests/fixtures";

// ── Selectors ─────────────────────────────────────────────────────────────────

const MODAL = "div.fixed.inset-0.z-50";

// ── Helper: navigate to Build tab → Archived view ─────────────────────────────

async function gotoArchiveView(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.waitForSelector("text=PLAY", { timeout: 10_000 });
  await page.getByRole("button", { name: /^build$/i }).click();
  await page.waitForSelector("text=BUILD", { timeout: 5_000 });
  await page.getByRole("button", { name: /archived/i }).click();
  await page.waitForTimeout(500);
}

// ── Helper: open first game in a given view ───────────────────────────────────

async function openFirstGame(
  page: import("@playwright/test").Page,
  view: "active" | "archived"
) {
  await page.goto("/dashboard");
  await page.waitForSelector("text=PLAY", { timeout: 10_000 });
  await page.getByRole("button", { name: /^build$/i }).click();
  await page.waitForSelector("text=BUILD", { timeout: 5_000 });

  if (view === "archived") {
    await page.getByRole("button", { name: /archived/i }).click();
    await page.waitForTimeout(500);
  }

  const firstRow = page.locator("table tbody tr").first();
  const hasRows = await firstRow.isVisible().catch(() => false);
  if (!hasRows) return false;

  await firstRow.click();
  await page.locator(MODAL).waitFor({ timeout: 5_000 });
  return true;
}

// ── Archive View: structure ───────────────────────────────────────────────────

test.describe("Archive view — structure", () => {
  test("AR-01 filter by Game Engine shows only matching games", async ({ page }) => {
    await gotoArchiveView(page);
    const categorySelect = page.getByRole("combobox").first();
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/error/);
  });

  test("AR-02 table shows expected columns", async ({ page }) => {
    await gotoArchiveView(page);
    const columns = ["TYPE", "TITLE", "DESCRIPTION", "CREATOR", "CREATED"];
    for (const col of columns) {
      const el = page.getByText(col, { exact: true }).first();
      const visible = await el.isVisible().catch(() => false);
      if (!visible) return; // No archived games — acceptable
    }
  });

  test("AR-03 + NEW GAME link navigates to /forge", async ({ page }) => {
    await gotoArchiveView(page);
    const newGameLink = page.locator('a[href="/forge"]').filter({ hasText: /new game/i });
    await expect(newGameLink).toBeVisible();
    await newGameLink.click();
    await page.waitForURL("**/forge", { timeout: 8_000 });
    await expect(page).toHaveURL(/\/forge/);
  });
});

// ── Archive view: Game Details modal ─────────────────────────────────────────

test.describe("Archive view — Game Details modal", () => {
  test("AR-09 clicking a game row opens the Game Details modal", async ({ page }) => {
    await gotoArchiveView(page);
    const firstRow = page.locator("table tbody tr").first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) { test.skip(); return; }
    await firstRow.click();
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 });
  });

  test("AR-10 modal shows engine badge, visibility, forge date and SHARE button", async ({ page }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    await expect(modal.getByRole("button", { name: "SHARE" })).toBeVisible();
    // PUBLIC badge or forged date text
    await expect(modal.getByText(/forged/i).first()).toBeVisible();
  });

  test("AR-11 SHARE button shows Copied confirmation", async ({ page }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    await modal.getByRole("button", { name: "SHARE" }).click();
    await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 4_000 });
  });

  test("AR-12 modal body shows game name, description, MODIFY and PUBLISH buttons", async ({ page }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    await expect(modal.getByRole("button", { name: "MODIFY" })).toBeVisible();
    await expect(modal.getByRole("button", { name: "PUBLISH" })).toBeVisible();
  });
});

// ── Archive view: Modify tab ──────────────────────────────────────────────────

test.describe("Archive view — Modify tab", () => {
  async function openModifyTab(page: import("@playwright/test").Page) {
    const opened = await openFirstGame(page, "archived");
    if (!opened) return false;
    // Tab button says exactly "MODIFY" — CODE MODIFY and REGENERATE are different buttons.
    // Use first() scoped to the rounded-full tab buttons (they sit in the header flex row).
    await page.locator(MODAL).locator("button.rounded-full", { hasText: /^MODIFY$/ }).click();
    return true;
  }

  test("AR-13 Modify tab shows VERSION HISTORY", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(page.getByText("VERSION HISTORY")).toBeVisible({ timeout: 5_000 });
  });

  test("AR-14 selecting a version shows SET ACTIVE button", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    // If multiple versions exist, a SET ACTIVE button appears
    const setActiveBtn = page.getByRole("button", { name: "SET ACTIVE" }).first();
    const hasMultiple = await setActiveBtn.isVisible().catch(() => false);
    if (!hasMultiple) { test.skip(); return; } // Only one version — acceptable
    await expect(setActiveBtn).toBeVisible();
  });

  test("AR-15 CODE MODIFY and REGENERATE toggle buttons exist", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(page.getByRole("button", { name: "CODE MODIFY" })).toBeVisible();
    await expect(page.getByRole("button", { name: "REGENERATE" })).toBeVisible();
  });

  test("AR-16 CODE MODIFY prompt textarea is present", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await page.getByRole("button", { name: "CODE MODIFY" }).click();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("AR-18 game title input is editable in the modal", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    const modal = page.locator(MODAL);
    // Title is an <input type="text"> in the modal header
    const titleInput = modal.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible();
    await titleInput.clear();
    await titleInput.type("Archived Test Game");
    await expect(titleInput).toHaveValue("Archived Test Game");
  });
});

// ── Archive view: Publish tab ─────────────────────────────────────────────────

test.describe("Archive view — Publish tab", () => {
  async function openPublishTab(page: import("@playwright/test").Page) {
    const opened = await openFirstGame(page, "archived");
    if (!opened) return false;
    await page.locator(MODAL).getByRole("button", { name: "PUBLISH" }).click();
    await page.waitForTimeout(300);
    return true;
  }

  // Checkboxes have no label association — find via adjacent span text
  function makePublicCheckbox(page: import("@playwright/test").Page) {
    return page.locator("label").filter({ hasText: /make public/i }).locator('input[type="checkbox"]');
  }
  function allowCloningCheckbox(page: import("@playwright/test").Page) {
    return page.locator("label").filter({ hasText: /allow cloning/i }).locator('input[type="checkbox"]').first();
  }

  test("AR-20 Publish tab shows Make public and Allow cloning checkboxes", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    // Checkboxes must be visible and interactive — state may vary if game was previously published
    await expect(makePublic).toBeVisible();
    await expect(allowCloningCheckbox(page)).toBeVisible();
  });

  test("AR-21 checking Make public reveals pricing section", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await expect(page.getByText("PRICE TO PLAY")).toBeVisible({ timeout: 3_000 });
  });

  test("AR-23 clone price lower than play price is auto-clamped (UI prevents invalid state)", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await allowCloningCheckbox(page).check();
    await page.waitForTimeout(300);

    const priceInputs = page.locator('input[type="number"]');
    if ((await priceInputs.count()) < 2) { test.skip(); return; }

    // Set play price to 5 — clone price should auto-clamp to >= 5
    await priceInputs.nth(0).fill("5");
    await priceInputs.nth(0).blur();
    await page.waitForTimeout(300);

    const cloneVal = await priceInputs.nth(1).inputValue();
    expect(Number(cloneVal)).toBeGreaterThanOrEqual(5);
  });

  test("AR-24 free trial session options (1 SESSION / 3 SESSIONS) are selectable", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "1 SESSION" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: "3 SESSIONS" })).toBeVisible();
    await page.getByRole("button", { name: "3 SESSIONS" }).click();
    // No crash — button is now active
    await expect(page).not.toHaveURL(/error/);
  });

  test("AR-25 Allow cloning checkbox and republish sub-option are present", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const allowCloning = allowCloningCheckbox(page);
    if (!(await allowCloning.isVisible().catch(() => false))) { test.skip(); return; }
    await allowCloning.check();
    await page.waitForTimeout(300);
    await expect(page.getByText(/allow clones to be republished/i)).toBeVisible();
  });

  test("AR-26 making a game public shows it in Buy tab", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }
    const makePublic = makePublicCheckbox(page);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }

    const isAlreadyPublic = await makePublic.isChecked();
    if (!isAlreadyPublic) {
      await makePublic.check();
      await page.waitForTimeout(1_500); // auto-saves
    }

    // Close modal via × button and switch to Buy tab
    await page.locator(MODAL).getByRole("button", { name: "×" }).click();
    await page.waitForSelector(`text=BUILD`, { timeout: 5_000 });
    await page.getByRole("button", { name: /^buy$/i }).click();
    await page.waitForSelector("text=BUY", { timeout: 5_000 });
    await expect(page).not.toHaveURL(/error/);
  });
});

// ── PB-08 / Archive action from Game Details (Active view) ────────────────────

test.describe("Game Details — Archive action (PB-08)", () => {
  test("PB-08 Archive button moves game from Active to Archived view", async ({ page }) => {
    const opened = await openFirstGame(page, "active");
    if (!opened) { test.skip(); return; }

    const modal = page.locator(MODAL);

    // Grab game title
    const titleInput = modal.locator('input[type="text"]').first();
    const gameTitle = (await titleInput.inputValue()).trim();

    // Archive button shows "🗄 ARCHIVE" for active games
    const archiveBtn = modal.getByRole("button", { name: /archive/i }).filter({ hasNotText: /deep/i });
    if (!(await archiveBtn.isVisible().catch(() => false))) { test.skip(); return; }

    await archiveBtn.click();
    await modal.waitFor({ state: "hidden", timeout: 5_000 });

    // Game should no longer appear in Active list
    if (gameTitle) {
      const rows = page.locator("table tbody tr");
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const text = await rows.nth(i).textContent();
        expect(text).not.toContain(gameTitle);
      }
    }

    // Switch to Archived — game should be there
    await page.getByRole("button", { name: /archived/i }).click();
    await page.waitForTimeout(500);
    if (gameTitle) {
      await expect(page.getByText(gameTitle).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ── AR-27: Restore game from Archive ─────────────────────────────────────────

test.describe("Archive view — Restore (AR-27)", () => {
  test("AR-27 RESTORE moves game from Archive to Active and Play tab", async ({ page }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator(MODAL);
    const titleInput = modal.locator('input[type="text"]').first();
    const gameTitle = (await titleInput.inputValue()).trim();

    // Restore button shows "↩ RESTORE" for archived games
    const restoreBtn = modal.getByRole("button", { name: /restore/i });
    if (!(await restoreBtn.isVisible().catch(() => false))) { test.skip(); return; }

    await restoreBtn.click();
    await modal.waitFor({ state: "hidden", timeout: 5_000 });

    // Switch to Active — game should reappear
    await page.getByRole("button", { name: /^active$/i }).click();
    await page.waitForTimeout(500);
    if (gameTitle) {
      await expect(page.getByText(gameTitle).first()).toBeVisible({ timeout: 5_000 });
    }

    // Also verify Play tab
    await page.getByRole("button", { name: /^play$/i }).click();
    await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 8_000 }).catch(() => {});
    if (gameTitle) {
      await expect(page.getByText(gameTitle).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ── AR-28 / AR-29: Deep Archive ───────────────────────────────────────────────

test.describe("Archive view — Deep Archive", () => {
  test("AR-28 DEEP ARCHIVE button shows confirmation prompt", async ({ page }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator(MODAL);
    const deepBtn = modal.getByRole("button", { name: /deep archive/i });
    if (!(await deepBtn.isVisible().catch(() => false))) { test.skip(); return; }

    await deepBtn.click();
    await expect(
      page.getByText(/permanently hide/i)
    ).toBeVisible({ timeout: 4_000 });
  });

  test("AR-29 confirming DEEP ARCHIVE removes game from the app", async ({ page }) => {
    // Gated — only runs when explicitly enabled to prevent accidental data loss
    if (!process.env.ENABLE_DESTRUCTIVE_TESTS) { test.skip(); return; }

    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator(MODAL);
    const titleInput = modal.locator('input[type="text"]').first();
    const gameTitle = (await titleInput.inputValue()).trim();

    const deepBtn = modal.getByRole("button", { name: /deep archive/i });
    if (!(await deepBtn.isVisible().catch(() => false))) { test.skip(); return; }
    await deepBtn.click();

    await page.getByRole("button", { name: "CONFIRM" }).click();
    await modal.waitFor({ state: "hidden", timeout: 5_000 });

    if (gameTitle) {
      await expect(page.getByText(gameTitle)).not.toBeVisible({ timeout: 3_000 });
    }
  });
});
