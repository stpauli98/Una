import { test, expect } from "@playwright/test";
import {
  getAppointmentByName,
  cleanupByName,
  SERVICE_ROLE_KEY,
} from "./helpers";
import { addDays, getDay } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  return date;
}

/**
 * Books via UI, then verifies ALL database fields are correctly persisted:
 * client_name, client_phone, client_email, notes, status, service_id,
 * confirmation_token, start_time, end_time duration consistency.
 */
test("booking data integrity — all fields persisted correctly", async ({
  page,
}) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const uniqueName = `E2E Integrity ${Date.now()}`;
  const target = futureWeekday(30);
  const dayNumber = target.getDate();

  try {
    // Book via UI — Šminkanje (60min)
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const firstSlot = page
      .getByRole("button", { name: /^\d{2}:\d{2}$/ })
      .first();
    await firstSlot.click();

    await page.getByLabel("Ime i prezime").fill(uniqueName);
    await page.getByLabel("Telefon").fill("+38765111222");
    await page.getByLabel("Email (opciono)").fill("integrity@test.com");
    await page.getByLabel("Napomena").fill("Test napomena");
    await page.getByLabel(/Saglasan/).check();
    await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();

    await expect(page).toHaveURL(/\/zakazi\/uspjesno\?token=[\w-]+/);

    // Verify DB state
    const row = await getAppointmentByName(uniqueName);
    expect(row).not.toBeNull();
    expect(row.client_name).toBe(uniqueName);
    expect(row.client_phone).toMatch(/38765111222/);
    expect(row.client_email).toBe("integrity@test.com");
    expect(row.notes).toBe("Test napomena");
    expect(row.status).toBe("ceka");
    expect(row.service_id).toBe(1);
    expect(row.confirmation_token).toBeTruthy();
    expect(row.start_time).toBeTruthy();
    expect(row.end_time).toBeTruthy();

    // end_time should be start_time + 60min (Šminkanje duration)
    const start = new Date(row.start_time);
    const end = new Date(row.end_time);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  } finally {
    await cleanupByName(uniqueName);
  }
});
