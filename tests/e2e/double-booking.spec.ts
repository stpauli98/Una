import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  cleanupByPrefix,
  SERVICE_ROLE_KEY,
  sarajevoDate,
} from "./helpers";
import { addDays, getDay } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  return sarajevoDate(date.getFullYear(), date.getMonth() + 1, date.getDate(), 17, 0);
}

test("double booking same slot is prevented", async ({ page }) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  // +6 days — visible in current month, unique offset
  const target = futureWeekday(6);
  const dayNumber = target.getDate();

  // Client A books 17:00 (seeded directly)
  const idA = await insertAppointment(1, target, 60, "E2E Double A");

  try {
    // Client B opens booking page
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    // 17:00 should NOT be available
    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    expect(slotTexts).not.toContain("17:00");
    expect(slotTexts).toContain("18:00");
  } finally {
    await deleteAppointment(idA);
    await cleanupByPrefix("E2E Double");
  }
});
