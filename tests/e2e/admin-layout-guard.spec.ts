import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
const NON_ADMIN_EMAIL = "non-admin-test@example.com";
const NON_ADMIN_PASSWORD = "Test1234A";

test.describe("admin layout guard", () => {
  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey);
    // Idempotentno kreiraj non-admin korisnika (greška "već postoji" se ignoriše)
    await admin.auth.admin.createUser({
      email: NON_ADMIN_EMAIL,
      password: NON_ADMIN_PASSWORD,
      email_confirm: true,
    });
  });

  test.afterAll(async () => {
    // NAPOMENA: Ako se test run prekine između beforeAll i afterAll
    // (npr. SIGINT, OOM), korisnik ostaje u Auth bazi. Sljedeći beforeAll
    // tolerira to kroz idempotentni create, pa nije blokirajuće.
    const admin = createClient(url, serviceKey);
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = data.users.find((x) => x.email === NON_ADMIN_EMAIL);
    if (u) await admin.auth.admin.deleteUser(u.id);
  });

  test("non-admin korisnik ne može doći do /admin/dashboard", async ({
    page,
  }) => {
    // Login kroz UI. Proxy je primarni guard — ovaj test asertuje
    // user-visible ponašanje (proxy ILI layout fallback ga vraća).
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(NON_ADMIN_EMAIL);
    await page.getByLabel("Lozinka").fill(NON_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Prijavi se" }).click();

    // Eksplicitno čekaj da URL ostane (ili se vrati) na login — sprječava
    // networkidle flake (Supabase realtime drži konekciju otvorenu).
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
    expect(page.url()).not.toContain("/admin/dashboard");
  });
});
