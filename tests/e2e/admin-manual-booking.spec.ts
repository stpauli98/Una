import { test, expect } from "@playwright/test";
import { addDays, getDay, format } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(19, 30, 0, 0);
  return date;
}

async function cleanupByName(name: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=eq.${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
}

test("admin manually creates appointment → appears in termini list", async ({
  page,
}) => {
  const adminEmail =
    process.env.E2E_ADMIN_EMAIL ?? "peranovicuna6@gmail.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminPassword || !SERVICE_ROLE_KEY) {
    test.skip(true, "admin credentials ili service role key nedostaje");
  }

  const testClientName = `E2E Manual ${Date.now()}`;

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Lozinka").fill(adminPassword!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Go to termini, klik Dodaj termin
    await page.goto("/admin/termini");
    await page.getByRole("button", { name: /Dodaj termin/ }).click();

    // Popuni formu
    await expect(
      page.getByRole("heading", { name: "Dodaj termin" }),
    ).toBeVisible();
    await page.getByLabel("Ime klijenta").fill(testClientName);
    await page.getByLabel("Telefon").fill("+38765999000");

    const target = nextBookableWeekday();
    const localValue = format(target, "yyyy-MM-dd'T'HH:mm");
    await page.getByLabel(/Datum i vrijeme/).fill(localValue);

    await page.getByRole("button", { name: "Sačuvaj" }).click();

    // Modal zatvoren, lista pokazuje novi termin
    await expect(page.getByText(testClientName)).toBeVisible({ timeout: 5000 });
  } finally {
    await cleanupByName(testClientName);
  }
});
