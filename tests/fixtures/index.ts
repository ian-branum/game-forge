/**
 * Shared Playwright fixtures and helpers for Game-Forge tests.
 */

import { test as base, expect, type Page } from "@playwright/test";

// ── Page Object: Landing Page ─────────────────────────────────────────────────

export class LandingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  get hero() {
    return this.page.locator("section").first();
  }

  get getStartedButton() {
    // The primary CTA — there are two; target the first (hero)
    return this.page.getByRole("button", { name: /get started/i }).first();
  }

  get engineCards() {
    return this.page.locator("text=🎮, text=⚔️, text=📖").locator("..");
  }

  async clickGetStarted() {
    await this.getStartedButton.click();
    await this.page.waitForURL("**/login");
  }
}

// ── Page Object: Login Page ───────────────────────────────────────────────────

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  get emailInput() {
    return this.page.getByLabel(/email/i);
  }

  get passwordInput() {
    return this.page.getByLabel(/^password$/i);
  }

  get signInButton() {
    return this.page.getByRole("button", { name: /^sign in$/i });
  }

  get errorMessage() {
    return this.page.locator("p.text-red-400");
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}

// ── Page Object: Dashboard ────────────────────────────────────────────────────

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/dashboard");
    await this.page.waitForSelector("text=PLAY", { timeout: 10_000 });
  }

  get playTab() {
    return this.page.getByRole("button", { name: /^play$/i });
  }

  get buildTab() {
    return this.page.getByRole("button", { name: /^build$/i });
  }

  get buyTab() {
    return this.page.getByRole("button", { name: /^buy$/i });
  }

  async switchTo(tab: "play" | "build" | "buy") {
    const btn = tab === "play" ? this.playTab : tab === "build" ? this.buildTab : this.buyTab;
    await btn.click();
    // Wait for the filter bar label to update
    await this.page.waitForSelector(`text=${tab.toUpperCase()}`, { timeout: 5_000 });
  }
}

// ── Page Object: Forge Page ───────────────────────────────────────────────────

export class ForgePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/forge");
    await this.page.waitForLoadState("networkidle");
  }

  get engineOptions() {
    return this.page.locator("[data-testid='engine-option'], .engine-card");
  }

  get descriptionInput() {
    return this.page.getByRole("textbox").first();
  }

  get forgeButton() {
    return this.page.getByRole("button", { name: /forge game/i });
  }

  get creditDisplay() {
    return this.page.getByText(/credits?/i).first();
  }
}

// ── Page Object: Game Details Modal ──────────────────────────────────────────

export class GameDetailsModal {
  constructor(private page: Page) {}

  get modal() {
    return this.page.locator("[role='dialog'], [data-testid='game-details-modal']");
  }

  get shareButton() {
    return this.modal.getByRole("button", { name: /share/i });
  }

  get modifyTab() {
    return this.modal.getByRole("tab", { name: /modify/i });
  }

  get publishTab() {
    return this.modal.getByRole("tab", { name: /publish/i });
  }

  async waitForOpen() {
    await this.modal.waitFor({ timeout: 6_000 });
  }

  async openModify() {
    await this.modifyTab.click();
  }

  async openPublish() {
    await this.publishTab.click();
  }
}

// ── Extended test fixture ─────────────────────────────────────────────────────

type GameForgeFixtures = {
  landing: LandingPage;
  loginPage: LoginPage;
  dashboard: DashboardPage;
  forge: ForgePage;
  gameDetails: GameDetailsModal;
};

export const test = base.extend<GameForgeFixtures>({
  landing: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboard: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  forge: async ({ page }, use) => {
    await use(new ForgePage(page));
  },
  gameDetails: async ({ page }, use) => {
    await use(new GameDetailsModal(page));
  },
});

export { expect };
