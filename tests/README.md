# Game-Forge — Playwright Test Suite

## Structure

```
tests/
  auth.setup.ts          Global setup: logs in once, saves auth state
  fixtures/
    index.ts             Page objects + extended test fixture
  smoke/
    landing.spec.ts      Public landing page
    auth.spec.ts         Login/signup flows & redirects
    dashboard.spec.ts    Dashboard tabs (authenticated)
  regression/
    nav.spec.ts          Nav bar & deep-link routing
    api.spec.ts          Public API contract checks
    marketplace.spec.ts  Marketplace Buy tab (authenticated)
playwright.config.ts     Playwright config (root of repo)
playwright/.auth/        Saved auth state (gitignored)
```

## Setup

### 1. Create a dedicated test account

Sign up at https://preview.game-forge.ai with an email/password you control.
Do **not** use a real player account — tests may modify state.

### 2. Export credentials

```bash
export E2E_EMAIL="your-test@example.com"
export E2E_PASSWORD="your-test-password"
```

Or add them to a `.env.test.local` file (gitignored via `.env*`).

### 3. Install Playwright browsers (if not already done)

```bash
npx playwright install chromium
```

## Running tests

```bash
# All tests (default: Chromium against preview.game-forge.ai)
npm run test:e2e

# Smoke suite only (fast — ~1 min)
npm run test:e2e:smoke

# Regression suite only
npm run test:e2e:regression

# Against local dev server
BASE_URL=http://localhost:3000 npm run test:e2e

# Open HTML report after a run
npm run test:e2e:report

# Run with headed browser (debugging)
npx playwright test --headed

# Show trace for a failed test
npx playwright show-trace playwright-report/results/<test>/trace.zip
```

## Projects

| Project       | Auth | Scope                          |
|---------------|------|-------------------------------|
| chromium      | ✅   | All tests except smoke/landing |
| mobile-chrome | ❌   | smoke/landing.spec.ts only    |
| setup         | —    | auth.setup.ts (global once)   |

## CI

Set `CI=true` to enable 1 retry per test and limit workers to 2.
Required env vars: `BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`.

## Adding tests

- Use page objects from `tests/fixtures/index.ts`
- Authenticated tests: import from `../../tests/fixtures` (uses saved auth)
- Unauthenticated tests: import from `@playwright/test` directly
- Add new page objects to `tests/fixtures/index.ts` as the app grows
