import { test, expect } from "@playwright/test";
import { addDays, format, getDay } from "date-fns";

/**
 * Pronađe prvi weekday (pon-pet) najmanje 2 dana u budućnosti —
 * tako da je sigurno van min_hours_before prozora (24h).
 */
function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 2);
  // 1..5 = pon..pet
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  return date;
}

test("booking flow happy path — Šminkanje 60min", async ({ page }) => {
  await page.goto("/zakazi");

  // Step 1 — izbor usluge
  await expect(page.getByRole("heading", { name: "Izaberite uslugu" })).toBeVisible();
  await page.getByRole("button", { name: /^Šminkanje/ }).first().click();

  // Step 2 — kalendar
  await expect(page.getByRole("heading", { name: "Izaberite termin" })).toBeVisible();

  const target = nextBookableWeekday();
  const dayNumber = target.getDate();

  // Kliknuti na dan (broj se može ponoviti u drugim mjesecima, ali kalendar prikazuje samo tekući mjesec)
  await page
    .getByRole("button", { name: String(dayNumber), exact: true })
    .first()
    .click();

  // Sačekaj slotove i klikni prvi
  await expect(page.getByText("Slobodni termini")).toBeVisible();
  const firstSlot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
  await firstSlot.click();

  // Step 3 — forma
  await expect(page.getByRole("heading", { name: "Vaši podaci" })).toBeVisible();

  const uniqueName = `Test Klijent ${Date.now()}`;
  await page.getByLabel("Ime i prezime").fill(uniqueName);
  await page.getByLabel("Telefon").fill("065123456");
  await page.getByLabel("Email (opciono)").fill("test@example.com");
  await page.getByLabel(/Saglasan/).check();
  await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();

  // Uspjesno stranica
  await expect(page).toHaveURL(/\/zakazi\/uspjesno\?id=\d+/);
  await expect(page.getByRole("heading", { name: "Termin primljen" })).toBeVisible();
  await expect(page.getByText(uniqueName)).toBeVisible();
});
