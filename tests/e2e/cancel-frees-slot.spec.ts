import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  SERVICE_ROLE_KEY,
} from "./helpers";
import { addDays, getDay } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

/**
 * Verifies that cancelling an appointment frees the slot for new bookings.
 * Uses the public booking UI to check slot visibility before and after cancel.
 */
test("cancelled appointment frees the slot for new bookings", async ({
  page,
}) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  // +5 days to stay visible in current month calendar view
  const target = futureWeekday(5);
  const dayNumber = target.getDate();

  // Seed: Šminkanje (id=1, 60min) at 17:00
  const id = await insertAppointment(1, target, 60, "E2E Cancel Frees");

  try {
    // Step 1: Verify 17:00 is NOT shown in booking UI
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slotsBefore = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();
    expect(slotsBefore).not.toContain("17:00");

    // Step 2: Cancel the appointment
    await updateAppointmentStatus(id, "otkazan");

    // Step 3: Refresh and verify 17:00 IS now available
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slotsAfter = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();
    expect(slotsAfter).toContain("17:00");
  } finally {
    await deleteAppointment(id);
  }
});
