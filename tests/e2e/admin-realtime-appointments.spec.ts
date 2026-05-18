import { test, expect } from "@playwright/test";

/**
 * Regression guard za AppointmentsRealtime mount.
 *
 * Test verifikuje da Termini i Dashboard otvore WebSocket konekciju ka
 * Supabase Realtime endpoint-u (`/realtime/v1/websocket`) nakon admin
 * login-a. Ako neko ukloni AppointmentsRealtime mount iz tih stranica,
 * `waitForEvent("websocket")` timeout-uje i test fail-uje.
 *
 * NE testira full event delivery (insert → refresh) — to bi zahtijevalo
 * paralelnu booking sesiju i timing assumptions; pokriveno manuel u PR
 * test plan-u.
 */

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const email = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Lozinka").fill(password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL(/\/admin\/dashboard/);
}

test.describe("Admin realtime subscription", () => {
  test("Termini page opens realtime websocket after login", async ({ page }) => {
    await loginAsAdmin(page);

    const wsPromise = page.waitForEvent("websocket", {
      predicate: (ws) => ws.url().includes("/realtime/v1/websocket"),
      timeout: 10_000,
    });
    await page.goto("/admin/termini");
    const ws = await wsPromise;
    expect(ws.url()).toContain("/realtime/v1/websocket");
  });

  test("Dashboard page opens realtime websocket after login", async ({ page }) => {
    await loginAsAdmin(page);

    const wsPromise = page.waitForEvent("websocket", {
      predicate: (ws) => ws.url().includes("/realtime/v1/websocket"),
      timeout: 10_000,
    });
    await page.goto("/admin/dashboard");
    const ws = await wsPromise;
    expect(ws.url()).toContain("/realtime/v1/websocket");
  });
});
