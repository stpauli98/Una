import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  SERVICE_ROLE_KEY,
} from "./helpers";
import { addDays, getDay, format } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

/**
 * Verifies that cancelling an appointment frees the slot for new bookings.
 * Uses the availability API directly to check slot presence.
 */
test("cancelled appointment frees the slot for new bookings", async ({
  request,
}) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const target = futureWeekday(20);
  const dateStr = format(target, "yyyy-MM-dd");

  // Seed: Šminkanje (id=1, 60min) at 17:00
  const id = await insertAppointment(1, target, 60, "E2E Cancel Frees");

  try {
    // Verify 17:00 is blocked
    const before = await request.get(
      `/api/availability?date=${dateStr}&service_id=1`,
    );
    const dataBefore = await before.json();
    const has17Before = dataBefore.slots?.some((s: { start: string }) =>
      s.start.includes("T17:00"),
    );
    expect(has17Before).toBeFalsy();

    // Cancel the appointment
    await updateAppointmentStatus(id, "otkazan");

    // Verify 17:00 is now available
    const after = await request.get(
      `/api/availability?date=${dateStr}&service_id=1`,
    );
    const dataAfter = await after.json();
    const has17After = dataAfter.slots?.some((s: { start: string }) =>
      s.start.includes("T17:00"),
    );
    expect(has17After).toBeTruthy();
  } finally {
    await deleteAppointment(id);
  }
});
