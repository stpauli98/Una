import { test, expect } from "@playwright/test";
import { addDays, getDay } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

/**
 * Pronađe prvi weekday (pon-pet) najmanje 2 dana u budućnosti —
 * tako da je sigurno van min_hours_before prozora (24h).
 */
function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 2);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
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

test("booking flow happy path — Šminkanje 60min", async ({ page }) => {
  const uniqueName = `Test Klijent ${Date.now()}`;

  try {
    await page.goto("/zakazi");

    // Step 1 — izbor usluge
    await expect(
      page.getByRole("heading", { name: "Izaberite uslugu" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Šminkanje/ }).first().click();

    // Step 2 — kalendar
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    const target = nextBookableWeekday();
    const dayNumber = target.getDate();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();
    const firstSlot = page
      .getByRole("button", { name: /^\d{2}:\d{2}$/ })
      .first();
    await firstSlot.click();

    // Step 3 — forma
    await expect(
      page.getByRole("heading", { name: "Vaši podaci" }),
    ).toBeVisible();

    await page.getByLabel("Ime i prezime").fill(uniqueName);
    await page.getByLabel("Telefon").fill("065123456");
    await page.getByLabel("Email (opciono)").fill("test@example.com");
    await page.getByLabel(/Saglasan/).check();
    await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();

    // Uspjesno stranica
    await expect(page).toHaveURL(/\/zakazi\/uspjesno\?id=\d+/);
    await expect(
      page.getByRole("heading", { name: "Termin primljen" }),
    ).toBeVisible();
    await expect(page.getByText(uniqueName)).toBeVisible();
  } finally {
    // Cleanup seedovanog termina da ne utiče na druge testove
    await cleanupByName(uniqueName);
  }
});
