/**
 * Regression — Profile modal & Sign Out (authenticated)
 * Covers: DB-07 through DB-15
 *
 * Profile modal: div.fixed.inset-0.z-50 (same pattern as game details modal)
 * Opened by: clicking button[aria-label="Account menu"] → menuitem "Profile"
 * Display name: input[type="text"] (plain input, no label association)
 * Save profile: button with text "SAVE PROFILE"
 * Password fields: identified by placeholder text
 * Password save: button with text "UPDATE PASSWORD"
 * Errors: <p> with inline color style (#f87171) — not p.text-red-400
 * Avatar buttons: button[aria-pressed] in an 8-column grid
 * Sign Out: menuitem inside role="menu" dropdown
 */

import { test, expect, type Page } from "@playwright/test";

const PROFILE_MODAL = "div.fixed.inset-0.z-50";

// ── Helper: open the avatar dropdown ─────────────────────────────────────────

async function openAvatarMenu(page: Page) {
  await page.goto("/dashboard");
  await page.waitForSelector("text=PLAY", { timeout: 10_000 });
  const avatarBtn = page.locator('button[aria-label="Account menu"]');
  await expect(avatarBtn).toBeVisible({ timeout: 5_000 });
  await avatarBtn.click();
  await page.waitForTimeout(300);
}

// ── Helper: open the Profile modal ───────────────────────────────────────────

async function openProfileModal(page: Page) {
  await openAvatarMenu(page);
  const profileItem = page.getByRole("menuitem", { name: /profile/i });
  await expect(profileItem).toBeVisible({ timeout: 3_000 });
  await profileItem.click();
  await page.locator(PROFILE_MODAL).waitFor({ timeout: 5_000 });
}

// ── DB-08: Avatar dropdown ────────────────────────────────────────────────────

test.describe("Header — avatar dropdown (DB-08)", () => {
  test("DB-08 avatar dropdown shows Profile and Sign Out options", async ({ page }) => {
    await openAvatarMenu(page);
    await expect(page.getByRole("menuitem", { name: /profile/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
  });
});

// ── DB-09: Edit Display Name ──────────────────────────────────────────────────

test.describe("Profile modal — Display Name (DB-09, DB-10)", () => {
  test("DB-09 can edit the Display Name field", async ({ page }) => {
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    // Display name is a plain input[type=text] — no label association
    const nameInput = modal.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill("TestCommander");
    await expect(nameInput).toHaveValue("TestCommander");
  });

  test("DB-10 saving a blank Display Name shows an error", async ({ page }) => {
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    // Wait for the profile fetch to complete — button is disabled while loading=true
    const saveBtn = modal.getByRole("button", { name: "SAVE PROFILE" });
    await expect(saveBtn).toBeEnabled({ timeout: 8_000 });
    const nameInput = modal.locator('input[type="text"]').first();
    await nameInput.clear();
    // Confirm it's actually blank before clicking
    await expect(nameInput).toHaveValue("");
    await saveBtn.click();
    // Error rendered as inline text in the modal
    await expect(modal.getByText(/display name cannot be empty/i)).toBeVisible({ timeout: 4_000 });
  });
});

// ── DB-11/DB-12: Avatar ───────────────────────────────────────────────────────

test.describe("Profile modal — Avatar (DB-11, DB-12)", () => {
  test("DB-11 can select a preset avatar", async ({ page }) => {
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    // Avatar buttons have aria-pressed attribute
    const avatarBtns = modal.locator("button[aria-pressed]");
    await expect(avatarBtns.first()).toBeVisible({ timeout: 5_000 });
    const count = await avatarBtns.count();
    expect(count).toBe(8); // 8 preset avatars
    // Click the first one that isn't already selected
    for (let i = 0; i < count; i++) {
      const btn = avatarBtns.nth(i);
      const pressed = await btn.getAttribute("aria-pressed");
      if (pressed === "false") {
        await btn.click();
        await expect(btn).toHaveAttribute("aria-pressed", "true");
        break;
      }
    }
  });

  test("DB-12 saving profile persists Display Name change", async ({ page }) => {
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    const nameInput = modal.locator('input[type="text"]').first();
    const newName = `Tester_${Date.now()}`.slice(0, 40);
    await nameInput.clear();
    await nameInput.fill(newName);
    await modal.getByRole("button", { name: "SAVE PROFILE" }).click();
    await expect(modal.getByText(/saved/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ── DB-13/DB-14/DB-15: Change Password ───────────────────────────────────────

test.describe("Profile modal — Change Password (DB-13, DB-14, DB-15)", () => {
  test("DB-13 OAuth users do not see Change Password section", async ({ page }) => {
    // The E2E test account (shaniejohnson026@gmail.com) is a Google OAuth account
    // so this test runs directly — no separate auth file needed.
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    // Wait for profile fetch to complete (hasPassword comes from API)
    await expect(modal.getByRole("button", { name: "SAVE PROFILE" })).toBeEnabled({ timeout: 8_000 });
    // Password fields must NOT be visible for OAuth accounts
    await expect(modal.getByPlaceholder("Current password")).not.toBeVisible();
    // App shows a note explaining why there's no password section
    await expect(modal.getByText(/sign in with google|no password/i)).toBeVisible();
  });

  test("DB-14 email/password users see Current, New and Confirm Password fields", async ({ page }) => {
    // The primary E2E account is OAuth — this test requires an email/password account.
    // Skipping here is correct: DB-14 is covered by manual testing or a dedicated
    // email/password test account. Set E2E_EMAIL_PASSWORD_ACCOUNT=true to un-skip
    // once such an account is configured.
    if (!process.env.E2E_EMAIL_PASSWORD_ACCOUNT) {
      test.skip();
      return;
    }
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    await expect(modal.getByRole("button", { name: "SAVE PROFILE" })).toBeEnabled({ timeout: 8_000 });
    await expect(modal.getByPlaceholder("Current password")).toBeVisible();
    await expect(modal.getByPlaceholder(/new password/i)).toBeVisible();
    await expect(modal.getByPlaceholder("Confirm new password")).toBeVisible();
    await expect(modal.getByRole("button", { name: "UPDATE PASSWORD" })).toBeVisible();
  });

  test("DB-15 new password shorter than 8 characters shows error", async ({ page }) => {
    // Same as DB-14 — requires an email/password account
    if (!process.env.E2E_EMAIL_PASSWORD_ACCOUNT) {
      test.skip();
      return;
    }
    await openProfileModal(page);
    const modal = page.locator(PROFILE_MODAL);
    await expect(modal.getByRole("button", { name: "SAVE PROFILE" })).toBeEnabled({ timeout: 8_000 });
    await modal.getByPlaceholder("Current password").fill("anything123");
    await modal.getByPlaceholder(/new password/i).fill("short");
    await modal.getByPlaceholder("Confirm new password").fill("short");
    await modal.getByRole("button", { name: "UPDATE PASSWORD" }).click();
    await expect(modal.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 4_000 });
  });
});

// ── DB-07: Sign Out ───────────────────────────────────────────────────────────

test.describe("Sign Out (DB-07)", () => {
  test("DB-07 signing out redirects to the landing page", async ({ page }) => {
    await openAvatarMenu(page);
    const signOutItem = page.getByRole("menuitem", { name: /sign out/i });
    await expect(signOutItem).toBeVisible({ timeout: 3_000 });
    await signOutItem.click();
    await page.waitForURL(/^https?:\/\/[^/]+\/?$/, { timeout: 10_000 });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/);
  });
});
