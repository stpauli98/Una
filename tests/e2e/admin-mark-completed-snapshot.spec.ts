import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { atSarajevo } from "@/lib/utils/tz";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("admin markCompleted — price snapshot regression", () => {
  test.skip(!serviceKey, "E2E_SUPABASE_SERVICE_ROLE_KEY nije setovan");

  let createdApptId: number;
  let originalServicePrice: number;
  const clientName = "E2E_SNAPSHOT_TEST";
  // Service ID 1 = Šminkanje 60min (vidi tests/e2e/dashboard-day-navigator.spec.ts:33)
  const serviceId = 1;
  const testPrice = 80;
  const newPrice = 100;

  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey!);

    // Snapshot original service price za restore u afterAll
    const { data: svc } = await admin
      .from("services")
      .select("price")
      .eq("id", serviceId)
      .single();
    originalServicePrice = Number(svc?.price ?? 80);

    // Set service.price na testnu vrijednost (80)
    await admin
      .from("services")
      .update({ price: testPrice })
      .eq("id", serviceId);

    // Seed termin sa status='potvrdjen' za juče u 14:00 Sarajevo
    // (ne treba biti danas — samo zavrsen status nam je interesantan)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const start = atSarajevo(
      yesterday.getUTCFullYear(),
      yesterday.getUTCMonth() + 1,
      yesterday.getUTCDate(),
      14,
      0,
    );
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data, error } = await admin
      .from("appointments")
      .insert({
        service_id: serviceId,
        client_name: clientName,
        client_phone: "+38765999222",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "potvrdjen",
        confirmation_token: crypto.randomUUID(),
      })
      .select("id")
      .single();
    if (error) throw error;
    createdApptId = data.id;
  });

  test.afterAll(async () => {
    if (!serviceKey) return;
    const admin = createClient(url, serviceKey);
    if (createdApptId) {
      await admin.from("appointments").delete().eq("id", createdApptId);
    }
    // Restore original price
    await admin
      .from("services")
      .update({ price: originalServicePrice })
      .eq("id", serviceId);
  });

  async function login(page: Page) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  }

  test("markCompleted snapshot-uje cijenu i opstaje pri price change-u", async ({
    page,
  }) => {
    const admin = createClient(url, serviceKey!);

    // Verifikuj početni state — price_snapshot je null
    const { data: before } = await admin
      .from("appointments")
      .select("price_snapshot")
      .eq("id", createdApptId)
      .single();
    expect(before?.price_snapshot).toBeNull();

    // Login + idi na termini za juče
    await login(page);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yStr = yesterday.toISOString().slice(0, 10);
    await page.goto(`/admin/termini?date=${yStr}`);
    await expect(page.getByText(clientName)).toBeVisible();

    // Klik "Završen" za seeded termin. Pošto klijent name je unique
    // (E2E_SNAPSHOT_TEST), nađi row koji ga sadrži i klikni Završen u njemu.
    const row = page.locator("div").filter({ hasText: clientName }).first();
    await row.getByRole("button", { name: "Završen" }).click();

    // Čekaj da revalidate završi (router.refresh)
    await page.waitForTimeout(500);

    // Query DB — snapshot je sad postavljen na testPrice (80)
    const { data: afterComplete } = await admin
      .from("appointments")
      .select("price_snapshot, status")
      .eq("id", createdApptId)
      .single();
    expect(afterComplete?.status).toBe("zavrsen");
    expect(Number(afterComplete?.price_snapshot)).toBe(testPrice);

    // Sad promijeni service.price na newPrice (100)
    await admin
      .from("services")
      .update({ price: newPrice })
      .eq("id", serviceId);

    // Re-query — snapshot je nepromijenjen (još uvijek 80)
    const { data: afterPriceChange } = await admin
      .from("appointments")
      .select("price_snapshot")
      .eq("id", createdApptId)
      .single();
    expect(Number(afterPriceChange?.price_snapshot)).toBe(testPrice);
  });
});
