import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  cleanupByPrefix,
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
 * Verifies that a slot booked by Client A is NOT shown to Client B.
 * Client A's appointment is seeded directly in DB, then Client B
 * checks the booking page — 17:00 must not appear.
 */
test("double booking same slot is prevented", async ({ page }) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const target = futureWeekday(25);
  const dayNumber = target.getDate();

  // Client A books first
  const idA = await insertAppointment(1, target, 60, "E2E Double A");

  try {
    // Client B opens booking page for same service
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    // Select the same day
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();

    // 17:00 should NOT be available (Client A has it)
    const slotButtons = page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ });
    const slotTexts = await slotButtons.allTextContents();

    expect(slotTexts).not.toContain("17:00");
    // 18:00 should still be available
    expect(slotTexts).toContain("18:00");
  } finally {
    await deleteAppointment(idA);
    await cleanupByPrefix("E2E Double");
  }
});
