import { test, expect, type Page } from "@playwright/test";
import { SUPABASE_URL, SERVICE_ROLE_KEY, supabaseHeaders } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Lozinka").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

async function createService(name: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      name,
      price: 50,
      duration_min: 60,
      category: "sminkanje",
      bookable: true,
      variable_price: false,
      active: true,
      order_index: 9999,
    }),
  });
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

async function cleanupServiceByName(name: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/services?name=eq.${encodeURIComponent(name)}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}

async function cleanupAppointmentsByPrefix(prefix: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=like.${encodeURIComponent(prefix + "*")}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}

test.describe.serial("admin service delete flow", () => {
  test.skip(!SERVICE_ROLE_KEY, "E2E_SUPABASE_SERVICE_ROLE_KEY needed");

  const cleanName = `E2E Delete Clean ${Date.now()}`;
  const lockedName = `E2E Delete Locked ${Date.now()}`;
  const apptPrefix = `E2E Delete Test ${Date.now()}`;

  test.afterAll(async () => {
    await cleanupAppointmentsByPrefix(apptPrefix);
    await cleanupServiceByName(cleanName);
    await cleanupServiceByName(lockedName);
  });

  test("uspješno briše uslugu bez appointment-a", async ({ page }) => {
    await createService(cleanName);
    await login(page);
    await page.goto("/admin/usluge");

    const heading = page.getByRole("heading", { name: cleanName, level: 4 });
    await expect(heading).toBeVisible();

    page.on("dialog", (dialog) => dialog.accept());

    await heading
      .locator("xpath=ancestor::*[contains(@class, 'border')][1]")
      .getByRole("button", { name: new RegExp(`Ukloni ${cleanName}`, "i") })
      .click();

    await expect(heading).toBeHidden({ timeout: 5000 });
  });

  test("blokira brisanje usluge sa appointment-ima + prikazuje friendly error", async ({
    page,
  }) => {
    const lockedId = await createService(lockedName);

    // Seed jedan appointment koji referencira ovu uslugu
    const future = new Date();
    future.setDate(future.getDate() + 14);
    future.setHours(10, 0, 0, 0);
    await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        service_id: lockedId,
        client_name: `${apptPrefix} Klijent`,
        client_phone: "+38761000000",
        start_time: future.toISOString(),
        end_time: new Date(future.getTime() + 60 * 60 * 1000).toISOString(),
        status: "potvrdjen",
      }),
    });

    await login(page);
    await page.goto("/admin/usluge");

    const heading = page.getByRole("heading", { name: lockedName, level: 4 });
    await expect(heading).toBeVisible();

    // Prati confirm + alert dialog-e
    let alertMessage: string | null = null;
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "confirm") {
        await dialog.accept();
      } else if (dialog.type() === "alert") {
        alertMessage = dialog.message();
        await dialog.accept();
      }
    });

    await heading
      .locator("xpath=ancestor::*[contains(@class, 'border')][1]")
      .getByRole("button", { name: new RegExp(`Ukloni ${lockedName}`, "i") })
      .click();

    // Sačekaj alert sa friendly porukom
    await expect
      .poll(() => alertMessage, { timeout: 5000 })
      .toMatch(/termina|deaktivirate/i);

    // Usluga ostaje vidljiva
    await expect(heading).toBeVisible();
  });
});
