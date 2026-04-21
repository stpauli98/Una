import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  SERVICE_ROLE_KEY,
  sarajevoDate,
} from "./helpers";
import { addDays, getDay } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  return sarajevoDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    17,
    0,
  );
}

/** Wait for at least one time slot button to appear after selecting a date */
async function waitForSlots(page: import("@playwright/test").Page) {
  await expect(page.getByText("Slobodni termini")).toBeVisible();
  // Wait for at least one HH:MM button to render (API response arrived)
  await expect(
    page.getByRole("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first(),
  ).toBeVisible({ timeout: 10000 });
}

test("cancelled appointment frees the slot for new bookings", async ({
  page,
}) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const target = futureWeekday(5);
  const dayNumber = target.getDate();

  // Seed: Šminkanje (id=1, 60min) at 17:00 Sarajevo
  const id = await insertAppointment(1, target, 60, "E2E Cancel Frees");

  try {
    // Step 1: Verify 17:00 is blocked
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    // Wait for slots to load, then check 17:00 is missing
    await expect(page.getByText("Slobodni termini")).toBeVisible();
    // Wait for API response — slots render asynchronously
    await page.waitForTimeout(2000);
    const slotsBefore = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();
    expect(slotsBefore).not.toContain("17:00");

    // Step 2: Cancel the appointment via Supabase API
    await updateAppointmentStatus(id, "otkazan");

    // Step 3: Refresh page and verify 17:00 IS now available
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    // Wait for slots to fully load
    await waitForSlots(page);
    const slotsAfter = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();
    expect(slotsAfter).toContain("17:00");
  } finally {
    await deleteAppointment(id);
  }
});
