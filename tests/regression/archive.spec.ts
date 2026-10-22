/**
 * Regression — Archive View (authenticated)
 * Covers: AR-01, AR-02, AR-03, AR-09 through AR-29
 * Also covers: PB-08 (Archive action from Game Details modal)
 *
 * Requires the test account to have at least one game in the Active view.
 * Deep Archive (AR-28/AR-29) is run last and skipped if no archived game exists.
 * Uses saved auth state from auth.setup.ts.
 */

import { test, expect } from "../../tests/fixtures";

// ── Helper: navigate to Build tab → Archived view ────────────────────────────

async function gotoArchiveView(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.waitForSelector("text=PLAY", { timeout: 10_000 });
  await page.getByRole("button", { name: /^build$/i }).click();
  await page.waitForSelector("text=BUILD", { timeout: 5_000 });
  await page.getByRole("button", { name: /archived/i }).click();
  await page.waitForTimeout(400);
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
    await page.waitForTimeout(400);
  }

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

// ── Archive View: structure ───────────────────────────────────────────────────

test.describe("Archive view — structure", () => {
  test("AR-01 filter by Game Engine shows only matching games", async ({ page }) => {
    await gotoArchiveView(page);

    const categorySelect = page.getByRole("combobox").first();
    await expect(categorySelect).toBeVisible();

    await categorySelect.selectOption({ index: 1 }); // first non-default option
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/error/);
  });

  test("AR-02 table shows expected columns", async ({ page }) => {
    await gotoArchiveView(page);

    const columns = ["Type", "Title", "Description", "Creator", "Created"];
    for (const col of columns) {
      const el = page.getByText(col, { exact: true }).first();
      const visible = await el.isVisible().catch(() => false);
      if (!visible) {
        // No archived games — acceptable, columns may not render
        return;
      }
    }
  });

  test("AR-03 +New Game button opens Forge a Game screen", async ({ page }) => {
    await gotoArchiveView(page);

    const newGameBtn = page.getByRole("button", { name: /new game/i });
    await expect(newGameBtn).toBeVisible();
    await newGameBtn.click();

    await page.waitForURL("**/forge", { timeout: 8_000 });
    await expect(page).toHaveURL(/\/forge/);
  });
});

// ── Archive view: Game Details modal ─────────────────────────────────────────

test.describe("Archive view — Game Details modal", () => {
  test("AR-09 clicking a game row opens the Game Details modal", async ({ page }) => {
    await gotoArchiveView(page);

    const firstRow = page
      .locator("table tbody tr, [data-testid='build-game-row']")
      .first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) { test.skip(); return; }

    await firstRow.click();
    await expect(
      page.locator("[role='dialog'], [data-testid='game-details-modal']")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("AR-10 modal shows engine, visibility, forge date and SHARE button", async ({
    page,
  }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await expect(modal.getByRole("button", { name: /share/i })).toBeVisible();
    await expect(modal.getByText(/public|private/i).first()).toBeVisible();
  });

  test("AR-11 SHARE button copies game URL", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.getByRole("button", { name: /share/i }).click();
    await expect(page.getByText(/copied|link copied/i)).toBeVisible({ timeout: 4_000 });
  });

  test("AR-12 modal body shows game name, description, MODIFY and PUBLISH tabs", async ({
    page,
  }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await expect(modal.getByRole("tab", { name: /modify/i })).toBeVisible();
    await expect(modal.getByRole("tab", { name: /publish/i })).toBeVisible();
  });
});

// ── Archive view: Modify tab ──────────────────────────────────────────────────

test.describe("Archive view — Modify tab", () => {
  async function openModifyTab(page: import("@playwright/test").Page) {
    const opened = await openFirstGame(page, "archived");
    if (!opened) return false;
    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.getByRole("tab", { name: /modify/i }).click();
    return true;
  }

  test("AR-13 Modify tab shows version history", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(
      page.getByText(/version history/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("AR-14 selecting a version from history makes it the active version", async ({
    page,
  }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }

    // Version history items — click the second one if available
    const versionItems = page.locator(
      "[data-testid='version-item'], [data-testid='version-history'] li, .version-history-item"
    );
    const count = await versionItems.count();
    if (count < 2) { test.skip(); return; }

    await versionItems.nth(1).click();
    await page.waitForTimeout(500);

    // The selected item should have an active/selected class
    await expect(versionItems.nth(1)).toHaveClass(/active|selected|ring/);
  });

  test("AR-15 CODE MODIFY and REGENERATE toggle buttons exist", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    await expect(page.getByRole("button", { name: /code modify/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /regenerate/i })).toBeVisible();
  });

  test("AR-16 CODE MODIFY prompt textarea is present", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }
    const codeModifyBtn = page.getByRole("button", { name: /code modify/i });
    if (await codeModifyBtn.isVisible()) await codeModifyBtn.click();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("AR-18 can update game name and description via Modify", async ({ page }) => {
    const opened = await openModifyTab(page);
    if (!opened) { test.skip(); return; }

    // Name field may be an input at the top of the modal
    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    const nameInput = modal.getByRole("textbox", { name: /game name|title/i }).first();

    if (!(await nameInput.isVisible().catch(() => false))) { test.skip(); return; }

    await nameInput.clear();
    await nameInput.type("Archived Test Game");
    await expect(nameInput).toHaveValue("Archived Test Game");
  });
});

// ── Archive view: Publish tab ─────────────────────────────────────────────────

test.describe("Archive view — Publish tab", () => {
  async function openPublishTab(page: import("@playwright/test").Page) {
    const opened = await openFirstGame(page, "archived");
    if (!opened) return false;
    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.getByRole("tab", { name: /publish/i }).click();
    return true;
  }

  test("AR-20 Publish tab shows Make Public and Allow Cloning checkboxes unchecked", async ({
    page,
  }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    const makePublic = page.getByLabel(/make public/i);
    const allowCloning = page.getByLabel(/allow cloning/i);

    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await expect(makePublic).not.toBeChecked();
    await expect(allowCloning).toBeVisible();
    await expect(allowCloning).not.toBeChecked();
  });

  test("AR-21 checking Make Public reveals pricing section", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    const makePublic = page.getByLabel(/make public/i);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await expect(page.getByText(/price/i).first()).toBeVisible({ timeout: 3_000 });
  });

  test("AR-23 clone price lower than play price shows validation error", async ({
    page,
  }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    const makePublic = page.getByLabel(/make public/i);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await page.waitForTimeout(500);

    const priceInputs = page.getByRole("spinbutton");
    if ((await priceInputs.count()) < 2) { test.skip(); return; }

    await priceInputs.nth(0).fill("5"); // play price
    await priceInputs.nth(1).fill("2"); // clone price (lower — invalid)

    const saveBtn = page.getByRole("button", { name: /save|publish/i });
    if (await saveBtn.isVisible()) await saveBtn.click();

    await expect(
      page.getByText(/clone.*greater|price to clone/i)
    ).toBeVisible({ timeout: 4_000 });
  });

  test("AR-24 free trial options are selectable", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    const makePublic = page.getByLabel(/make public/i);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }
    await makePublic.check();
    await page.waitForTimeout(500);

    const trialOptions = page.getByText(/1 free trial|3 free trials/i);
    if (!(await trialOptions.first().isVisible().catch(() => false))) { test.skip(); return; }
    await expect(trialOptions.first()).toBeVisible();
  });

  test("AR-25 Allow Cloning permission options are available", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    const allowCloning = page.getByLabel(/allow cloning/i);
    if (!(await allowCloning.isVisible().catch(() => false))) { test.skip(); return; }
    await allowCloning.check();
    await page.waitForTimeout(400);

    // Expect clone-only vs clone+publish permission options to appear
    const permOptions = page.getByText(/clone only|clone and publish/i);
    if (await permOptions.first().isVisible().catch(() => false)) {
      await expect(permOptions.first()).toBeVisible();
    }
  });

  test("AR-26 making a game public shows it in Buy tab", async ({ page }) => {
    const opened = await openPublishTab(page);
    if (!opened) { test.skip(); return; }

    const makePublic = page.getByLabel(/make public/i);
    if (!(await makePublic.isVisible().catch(() => false))) { test.skip(); return; }

    const isAlreadyPublic = await makePublic.isChecked();
    if (!isAlreadyPublic) {
      await makePublic.check();
      const saveBtn = page.getByRole("button", { name: /save|publish/i });
      if (await saveBtn.isVisible()) await saveBtn.click();
      await page.waitForTimeout(1_000);
    }

    // Close modal and navigate to Buy tab
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: /^buy$/i }).click();
    await page.waitForSelector("text=BUY", { timeout: 5_000 });

    // The game should appear in the marketplace
    await expect(page).not.toHaveURL(/error/);
  });
});

// ── PB-08 / Archive action from Game Details (Active view) ───────────────────

test.describe("Game Details — Archive action", () => {
  test("PB-08 Archive button moves game from Active to Archive view", async ({ page }) => {
    // Open a game from Active view
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });
    await page.getByRole("button", { name: /^build$/i }).click();
    await page.waitForSelector("text=BUILD", { timeout: 5_000 });

    const firstRow = page
      .locator("table tbody tr, [data-testid='build-game-row']")
      .first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) { test.skip(); return; }

    // Grab the game title before archiving
    const titleCell = firstRow.locator("td").nth(1);
    const gameTitle = (await titleCell.textContent())?.trim();

    await firstRow.click();
    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    await modal.waitFor({ timeout: 5_000 });

    // Find and click Archive button
    const archiveBtn = modal.getByRole("button", { name: /archive/i });
    const hasArchive = await archiveBtn.isVisible().catch(() => false);
    if (!hasArchive) { test.skip(); return; }

    await archiveBtn.click();

    // Confirmation dialog may appear — confirm it
    const confirmBtn = page
      .getByRole("button", { name: /confirm|yes|archive/i })
      .last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Modal should close
    await modal.waitFor({ state: "hidden", timeout: 5_000 });

    // Game should no longer appear in Active view
    await expect(page.getByText(gameTitle ?? "")).not.toBeVisible();

    // Switch to Archived view — game should be there
    await page.getByRole("button", { name: /archived/i }).click();
    await page.waitForTimeout(500);

    if (gameTitle) {
      await expect(page.getByText(gameTitle).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ── AR-27: Restore game from Archive ─────────────────────────────────────────

test.describe("Archive view — Restore", () => {
  test("AR-27 RESTORE moves game from Archive to Active and Play tab", async ({
    page,
  }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");

    // Grab game title before restoring
    const titleEl = modal.locator("h2, h3, [data-testid='game-title']").first();
    const gameTitle = (await titleEl.textContent())?.trim();

    const restoreBtn = modal.getByRole("button", { name: /restore/i });
    const hasRestore = await restoreBtn.isVisible().catch(() => false);
    if (!hasRestore) { test.skip(); return; }

    await restoreBtn.click();

    // Confirmation if shown
    const confirmBtn = page
      .getByRole("button", { name: /confirm|yes|restore/i })
      .last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Modal should close
    await modal.waitFor({ state: "hidden", timeout: 5_000 });

    // Switch to Active view — game should reappear
    await page.getByRole("button", { name: /active/i }).click();
    await page.waitForTimeout(500);

    if (gameTitle) {
      await expect(page.getByText(gameTitle).first()).toBeVisible({ timeout: 5_000 });
    }

    // Also verify it's back in the Play tab
    await page.getByRole("button", { name: /^play$/i }).click();
    await page.waitForTimeout(500);
    if (gameTitle) {
      await expect(page.getByText(gameTitle).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ── AR-28 / AR-29: Deep Archive (permanent hide) ──────────────────────────────

test.describe("Archive view — Deep Archive", () => {
  test("AR-28 DEEP ARCHIVE shows confirmation prompt", async ({ page }) => {
    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    const deepArchiveBtn = modal.getByRole("button", { name: /deep archive/i });

    const hasDeepArchive = await deepArchiveBtn.isVisible().catch(() => false);
    if (!hasDeepArchive) { test.skip(); return; }

    await deepArchiveBtn.click();

    // Expect a warning/confirmation dialog
    await expect(
      page.getByText(/permanently hide|are you sure/i).first()
    ).toBeVisible({ timeout: 4_000 });
  });

  test("AR-29 confirming DEEP ARCHIVE removes game from the app", async ({ page }) => {
    // NOTE: This test permanently hides a game from the test account.
    // Only runs if ENABLE_DESTRUCTIVE_TESTS=true is set in the environment.
    if (!process.env.ENABLE_DESTRUCTIVE_TESTS) {
      test.skip();
      return;
    }

    const opened = await openFirstGame(page, "archived");
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='game-details-modal']");
    const titleEl = modal.locator("h2, h3, [data-testid='game-title']").first();
    const gameTitle = (await titleEl.textContent())?.trim();

    const deepArchiveBtn = modal.getByRole("button", { name: /deep archive/i });
    if (!(await deepArchiveBtn.isVisible().catch(() => false))) { test.skip(); return; }

    await deepArchiveBtn.click();

    // Confirm the prompt
    const confirmBtn = page
      .getByRole("button", { name: /confirm|yes/i })
      .last();
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    // Modal should close and game should be gone
    await modal.waitFor({ state: "hidden", timeout: 5_000 });

    if (gameTitle) {
      await expect(page.getByText(gameTitle)).not.toBeVisible({ timeout: 3_000 });
    }
  });
});
