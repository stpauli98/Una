import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
const NON_ADMIN_EMAIL = "non-admin-test@example.com";
const NON_ADMIN_PASSWORD = "Test1234A";

test.describe("admin layout guard", () => {
  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey);
    // Idempotently create the non-admin user (ignore "already exists" error)
    await admin.auth.admin.createUser({
      email: NON_ADMIN_EMAIL,
      password: NON_ADMIN_PASSWORD,
      email_confirm: true,
    });
  });

  test.afterAll(async () => {
    const admin = createClient(url, serviceKey);
    const { data } = await admin.auth.admin.listUsers();
    const u = data.users.find((x) => x.email === NON_ADMIN_EMAIL);
    if (u) await admin.auth.admin.deleteUser(u.id);
  });

  test("non-admin authenticated user cannot reach /admin/dashboard", async ({
    page,
  }) => {
    // Sign in via the login form. Proxy will reject before layout runs;
    // this asserts the user-visible behavior is "you cannot reach the dashboard."
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', NON_ADMIN_EMAIL);
    await page.fill('input[name="password"]', NON_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // The user should not land on the dashboard. They will either remain on
    // /admin/login (with an error) or be redirected back to it by the proxy.
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/admin/dashboard");
  });
});
