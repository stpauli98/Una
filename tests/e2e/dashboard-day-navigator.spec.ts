import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { atSarajevo } from "@/lib/utils/tz";
import { addDaysToDateStr, sarajevoTodayDateStr } from "@/lib/utils/day-bounds";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;

const todayStr = sarajevoTodayDateStr();
const tomorrowStr = addDaysToDateStr(todayStr, 1);
const dayAfterStr = addDaysToDateStr(todayStr, 2);

test.describe("dashboard day navigator", () => {
  let createdIds: number[] = [];

  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey);
    // Seed 3 termina: danas, sutra, prekosutra. Service id 1 = Šminkanje 60min.
    // Status = potvrdjen (zaobilazi anon RLS check za status='ceka').
    const seeds = [
      { dateStr: todayStr, hour: 18, name: "E2E_NAV_DANAS" },
      { dateStr: tomorrowStr, hour: 18, name: "E2E_NAV_SUTRA" },
      { dateStr: dayAfterStr, hour: 18, name: "E2E_NAV_PREKOSUTRA" },
    ];
    for (const seed of seeds) {
      const [y, m, d] = seed.dateStr.split("-").map(Number);
      const start = atSarajevo(y, m, d, seed.hour, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const { data, error } = await admin
        .from("appointments")
        .insert({
          service_id: 1,
          client_name: seed.name,
          client_phone: "+38765999000",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "potvrdjen",
          confirmation_token: crypto.randomUUID(),
        })
        .select("id")
        .single();
      if (error) throw error;
      createdIds.push(data.id);
    }
  });

  test.afterAll(async () => {
    if (createdIds.length === 0) return;
    const admin = createClient(url, serviceKey);
    await admin.from("appointments").delete().in("id", createdIds);
  });

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  }

  test("dashboard prikazuje termin za današnji dan po default-u", async ({
    page,
  }) => {
    await login(page);

    // "danas" oznaka u date label
    await expect(page.getByText("· danas")).toBeVisible();
    // Današnji termin vidljiv u listi
    await expect(page.getByText("E2E_NAV_DANAS")).toBeVisible();
    // Sutra/prekosutra NIJE vidljivo
    await expect(page.getByText("E2E_NAV_SUTRA")).not.toBeVisible();
    await expect(page.getByText("E2E_NAV_PREKOSUTRA")).not.toBeVisible();
  });

  test("strelica naprijed prikazuje sutrašnji termin", async ({ page }) => {
    await login(page);

    await page.getByLabel("Sljedeći dan").click();
    await expect(page).toHaveURL(new RegExp(`date=${tomorrowStr}`));

    await expect(page.getByText("E2E_NAV_SUTRA")).toBeVisible();
    await expect(page.getByText("E2E_NAV_DANAS")).not.toBeVisible();

    // "Danas" dugme se sad pojavilo
    await expect(page.getByRole("button", { name: "Danas" })).toBeVisible();
  });

  test("URL param ?date=neispravan → fallback na današnji", async ({ page }) => {
    await login(page);

    await page.goto("/admin/dashboard?date=not-a-date");
    // Ne treba reload-ovati URL — server fallback radi tiho i prikazuje danas
    await expect(page.getByText("E2E_NAV_DANAS")).toBeVisible();
    // "danas" oznaka prisutna (znači selectedDateStr === todayStr nakon fallback-a)
    await expect(page.getByText("· danas")).toBeVisible();
  });
});
