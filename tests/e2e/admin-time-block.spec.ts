import { test, expect } from "@playwright/test";
import { addDays, getDay, format } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

// Serial mode jer test manipuliše globalno stanje (time_blocks tabela)
// a paralelni testovi bi mogli da kreiraju sukobljene blokove.
test.describe.configure({ mode: "serial" });

function nextBookableWeekday(): Date {
  // Koristimo +7 dana da se ne preklapa sa drugim e2e testovima koji
  // biraju sljedeći weekday (+3) — tako izbjegavamo kolizije u paralelnom
  // izvršavanju.
  let date = addDays(new Date(), 7);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(18, 0, 0, 0);
  return date;
}

async function cleanupBlockByReason(reason: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/time_blocks?reason=eq.${encodeURIComponent(reason)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
}

test("admin creates time block → public calendar hides overlapping slot", async ({
  page,
}) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";
  test.skip(!SERVICE_ROLE_KEY, "E2E_SUPABASE_SERVICE_ROLE_KEY needed");

  const uniqueReason = `E2E block ${Date.now()}`;

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Lozinka").fill(adminPassword);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Go to postavke
    await page.goto("/admin/postavke");
    await expect(
      page.getByRole("heading", { name: /Blokirani intervali/ }),
    ).toBeVisible();

    // Popuni formu za time block
    const target = nextBookableWeekday();
    const endTime = new Date(target);
    endTime.setHours(19, 0, 0, 0);

    const startLocal = format(target, "yyyy-MM-dd'T'HH:mm");
    const endLocal = format(endTime, "yyyy-MM-dd'T'HH:mm");

    // Scope selector na formu sa start_time_local (time_blocks forma)
    const form = page
      .locator("form")
      .filter({ has: page.locator('input[name="start_time_local"]') });
    await form.locator('input[name="start_time_local"]').fill(startLocal);
    await form.locator('input[name="end_time_local"]').fill(endLocal);
    await form.locator('input[name="reason"]').fill(uniqueReason);
    await form.getByRole("button", { name: /Dodaj/ }).click();

    // Block se pojavljuje u listi
    await expect(page.getByText(uniqueReason)).toBeVisible({ timeout: 5000 });

    // Provjeri public kalendar
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slots = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Block je 18:00-19:00
    // 18:00 i 17:30 i 18:30 overlaipuju — blokirano
    expect(slots).not.toContain("18:00");
    expect(slots).not.toContain("17:30");
    expect(slots).not.toContain("18:30");
    expect(slots).toContain("17:00");
    expect(slots).toContain("19:00");
  } finally {
    await cleanupBlockByReason(uniqueReason);
  }
});
