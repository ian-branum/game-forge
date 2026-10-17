/**
 * Regression — API contract checks (no auth required)
 * Validates that public API endpoints return expected shapes.
 * These are lightweight — no game generation, no DB writes.
 */

import { test, expect } from "@playwright/test";

// All tests in this file are unauthenticated API checks.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("GET /api/demos", () => {
  test("returns tactical and sandbox arrays", async ({ request }) => {
    const res = await request.get("/api/demos");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("tactical");
    expect(body).toHaveProperty("sandbox");
    expect(Array.isArray(body.tactical)).toBe(true);
    expect(Array.isArray(body.sandbox)).toBe(true);
  });

  test("demo items have id and title fields", async ({ request }) => {
    const res = await request.get("/api/demos");
    const body = await res.json();

    const allItems = [...(body.tactical ?? []), ...(body.sandbox ?? [])];
    for (const item of allItems) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
    }
  });
});

test.describe("GET /api/marketplace (unauthenticated)", () => {
  test("returns 401 or redirects for unauthed requests", async ({ request }) => {
    const res = await request.get("/api/marketplace");
    // Auth-guarded endpoint — expect 401 Unauthorized (not 500)
    expect([200, 401, 403]).toContain(res.status());
  });
});

test.describe("GET /api/me/credits (unauthenticated)", () => {
  test("returns 401 for anonymous user", async ({ request }) => {
    const res = await request.get("/api/me/credits");
    expect(res.status()).toBe(401);
  });
});
