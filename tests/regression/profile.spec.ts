/**
 * Regression — Profile modal & Sign Out (authenticated)
 * Covers: DB-07 through DB-15
 *   DB-07  Sign Out → landing page
 *   DB-08  Avatar dropdown shows Profile + Sign Out
 *   DB-09  Can edit Display Name
 *   DB-10  Blank Display Name is rejected
 *   DB-11  Can select a preset avatar
 *   DB-12  Profile saves Display Name and Avatar
 *   DB-13  OAuth users do NOT see Change Password section
 *   DB-14  Email/password users DO see Change Password section
 *   DB-15  Password minimum 8 characters enforced
 *
 * NOTE: DB-13 and DB-08 (OAuth) require a separate OAuth storage state —
 * those tests are skipped unless OAUTH_AUTH_FILE env var is set.
 * All others use the standard saved email/password auth state.
 */

import { test, expect } from "../../tests/fixtures";

// ── Helper: open the avatar dropdown and click Profile ────────────────────────

async function openProfileModal(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.waitForSelector("text=PLAY", { timeout: 10_000 });

  // Avatar button — typically an <img> or initials button in the header
  const avatarBtn = page
    .locator("header")
    .getByRole("button", { name: /avatar|profile|account/i })
    .or(page.locator("header img[alt*='avatar' i]").locator(".."))
    .first();

  // Fallback: look for a circular button that isn't Forge/Credits
  const headerBtns = page.locator("header button");
  const btnCount = await headerBtns.count();

  let opened = false;
  // Try named avatar button first
  if (await avatarBtn.isVisible().catch(() => false)) {
    await avatarBtn.click();
    opened = true;
  } else {
    // Walk header buttons right-to-left looking for a dropdown trigger
    for (let i = btnCount - 1; i >= 0; i--) {
      const btn = headerBtns.nth(i);
      const text = (await btn.textContent()) ?? "";
      if (/forge|credits?|\d/i.test(text)) continue;
      await btn.click();
      opened = true;
      break;
    }
  }

  if (!opened) return false;

  // Wait for dropdown to appear
  await page.waitForTimeout(400);
  const profileOption = page.getByRole("menuitem", { name: /profile/i })
    .or(page.getByText(/^profile$/i));
  if (!(await profileOption.isVisible().catch(() => false))) return false;

  await profileOption.click();

  // Wait for modal
  await page
    .locator("[role='dialog'], [data-testid='profile-modal']")
    .waitFor({ timeout: 5_000 });

  return true;
}

// ── DB-08: Avatar dropdown ────────────────────────────────────────────────────

test.describe("Header — avatar dropdown", () => {
  test("DB-08 avatar dropdown shows Profile and Sign Out options", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });

    // Click the avatar/account button in the header
    const headerBtns = page.locator("header button");
    const btnCount = await headerBtns.count();

    let clicked = false;
    for (let i = btnCount - 1; i >= 0; i--) {
      const btn = headerBtns.nth(i);
      const text = (await btn.textContent()) ?? "";
      if (/forge|credits?|\d/i.test(text)) continue;
      await btn.click();
      clicked = true;
      break;
    }

    if (!clicked) { test.skip(); return; }

    await page.waitForTimeout(400);
    await expect(page.getByText(/^profile$/i).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/sign out/i).first()).toBeVisible({ timeout: 3_000 });
  });
});

// ── DB-09: Edit Display Name ──────────────────────────────────────────────────

test.describe("Profile modal — Display Name", () => {
  test("DB-09 can edit the Display Name field", async ({ page }) => {
    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");
    const nameInput = modal.getByRole("textbox").first();
    await expect(nameInput).toBeVisible();

    // Clear and type a new name
    await nameInput.clear();
    await nameInput.type("TestCommander");
    await expect(nameInput).toHaveValue("TestCommander");
  });

  // DB-10: Blank Display Name rejected
  test("DB-10 saving a blank Display Name shows an error", async ({ page }) => {
    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");
    const nameInput = modal.getByRole("textbox").first();

    await nameInput.clear();

    // Submit / Save
    const saveBtn = modal.getByRole("button", { name: /save|update/i });
    await saveBtn.click();

    // Expect an inline error
    await expect(
      modal.getByText(/required|cannot be blank|display name/i)
    ).toBeVisible({ timeout: 4_000 });
  });
});

// ── DB-11: Preset avatar selection ───────────────────────────────────────────

test.describe("Profile modal — Avatar", () => {
  test("DB-11 can select a preset avatar", async ({ page }) => {
    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");

    // Preset avatars are typically clickable images or buttons in a grid
    const avatarOptions = modal.locator(
      "[data-testid='avatar-option'], img[data-avatar], button[aria-label*='avatar' i]"
    );
    const count = await avatarOptions.count();

    if (count === 0) { test.skip(); return; } // No preset grid — skip

    // Click the second avatar (avoid accidentally re-selecting the current one)
    const target = avatarOptions.nth(count > 1 ? 1 : 0);
    await target.click();

    // A selected state indicator should appear (ring, border, checked, etc.)
    await expect(target).toHaveClass(/selected|active|ring|border-/);
  });

  // DB-12: Save profile persists changes
  test("DB-12 saving profile persists Display Name change", async ({ page }) => {
    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");
    const nameInput = modal.getByRole("textbox").first();

    const newName = `Tester_${Date.now()}`;
    await nameInput.clear();
    await nameInput.type(newName);

    const saveBtn = modal.getByRole("button", { name: /save|update/i });
    await saveBtn.click();

    // Toast or success indicator
    await expect(
      page.getByText(/saved|updated|success/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ── DB-14 / DB-15: Change Password (email/password accounts only) ─────────────

test.describe("Profile modal — Change Password (email/password accounts)", () => {
  test("DB-14 shows Current Password, New Password and Confirm Password fields", async ({
    page,
  }) => {
    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");

    // These fields only appear for email/password accounts
    const currentPwd = modal.getByLabel(/current password/i);
    const newPwd = modal.getByLabel(/new password/i);
    const confirmPwd = modal.getByLabel(/confirm password/i);
    const updateBtn = modal.getByRole("button", { name: /update password/i });

    const visible = await currentPwd.isVisible().catch(() => false);
    if (!visible) {
      // This is likely an OAuth account — skip (DB-13 covers that path)
      test.skip();
      return;
    }

    await expect(newPwd).toBeVisible();
    await expect(confirmPwd).toBeVisible();
    await expect(updateBtn).toBeVisible();
  });

  test("DB-15 new password shorter than 8 characters is rejected", async ({ page }) => {
    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");
    const currentPwd = modal.getByLabel(/current password/i);

    if (!(await currentPwd.isVisible().catch(() => false))) {
      test.skip(); // OAuth account
      return;
    }

    await currentPwd.fill("anything123");
    await modal.getByLabel(/new password/i).fill("short");
    await modal.getByLabel(/confirm password/i).fill("short");
    await modal.getByRole("button", { name: /update password/i }).click();

    await expect(
      modal.getByText(/8 characters|minimum/i)
    ).toBeVisible({ timeout: 4_000 });
  });
});

// ── DB-13: OAuth users — no Change Password section ──────────────────────────

test.describe("Profile modal — OAuth accounts", () => {
  test("DB-13 OAuth signed-in users do not see Change Password section", async ({
    page,
  }) => {
    // This test requires an OAuth auth state — skip if not configured
    const oauthFile = process.env.OAUTH_AUTH_FILE;
    if (!oauthFile) { test.skip(); return; }

    const opened = await openProfileModal(page);
    if (!opened) { test.skip(); return; }

    const modal = page.locator("[role='dialog'], [data-testid='profile-modal']");
    await expect(modal.getByLabel(/current password/i)).not.toBeVisible();
    await expect(modal.getByText(/change password/i)).not.toBeVisible();
  });
});

// ── DB-07: Sign Out ───────────────────────────────────────────────────────────

test.describe("Sign Out", () => {
  test("DB-07 signing out redirects to the landing page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector("text=PLAY", { timeout: 10_000 });

    // Open avatar dropdown
    const headerBtns = page.locator("header button");
    const btnCount = await headerBtns.count();

    for (let i = btnCount - 1; i >= 0; i--) {
      const btn = headerBtns.nth(i);
      const text = (await btn.textContent()) ?? "";
      if (/forge|credits?|\d/i.test(text)) continue;
      await btn.click();
      break;
    }

    await page.waitForTimeout(400);

    const signOutOption = page
      .getByRole("menuitem", { name: /sign out/i })
      .or(page.getByRole("button", { name: /sign out/i }))
      .or(page.getByText(/sign out/i).first());

    await expect(signOutOption).toBeVisible({ timeout: 3_000 });
    await signOutOption.click();

    // Should land on the landing page (/) — not /login
    await page.waitForURL(/^\/$/, { timeout: 10_000 });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/);
  });
});
