import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { sarajevoTodayDateStr, getSarajevoDayBounds } from "@/lib/utils/day-bounds";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("admin Termini — TZ regression (NALAZ A)", () => {
  test.skip(!serviceKey, "E2E_SUPABASE_SERVICE_ROLE_KEY nije setovan");

  let createdId: number;
  let todayStr: string;
  const clientName = "E2E_TZ_REGRESSION";

  test.beforeAll(async () => {
    todayStr = sarajevoTodayDateStr();
    // Termin u 00:30 Sarajevo today — rana jutarnja granica koja bi
    // prethodno bila propuštena pod range=danas zbog server TZ bug-a.
    const dayBounds = getSarajevoDayBounds(todayStr);
    const startMs = new Date(dayBounds.start).getTime() + 30 * 60 * 1000;
    const start = new Date(startMs);
    const end = new Date(startMs + 60 * 60 * 1000);

    const admin = createClient(url, serviceKey!);
    // Service ID 1 = Šminkanje 60min (vidi tests/e2e/dashboard-day-navigator.spec.ts:33)
    const { data, error } = await admin
      .from("appointments")
      .insert({
        service_id: 1,
        client_name: clientName,
        client_phone: "+38765999111",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "potvrdjen",
        confirmation_token: crypto.randomUUID(),
      })
      .select("id")
      .single();
    if (error) throw error;
    createdId = data.id;
  });

  test.afterAll(async () => {
    if (!createdId || !serviceKey) return;
    const admin = createClient(url, serviceKey);
    await admin.from("appointments").delete().eq("id", createdId);
  });

  async function login(page: Page) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  }

  test("termin u 00:30 Sarajevo vidljiv je pod ?range=danas", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/admin/termini?range=danas");
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test("isti termin vidljiv je pod ?date=<today>", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/termini?date=${todayStr}`);
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test("count termina jednak je između range=danas i date=<today> (konzistencija)", async ({
    page,
  }) => {
    await login(page);

    await page.goto("/admin/termini?range=danas");
    const rangeCount = await page.getByText(clientName).count();

    await page.goto(`/admin/termini?date=${todayStr}`);
    const dateCount = await page.getByText(clientName).count();

    expect(rangeCount).toBe(dateCount);
    expect(rangeCount).toBeGreaterThanOrEqual(1);
  });
});
