import {
  addMinutes,
  differenceInHours,
  differenceInCalendarDays,
  isBefore,
  startOfDay,
} from "date-fns";
import type {
  BlockedRange,
  ExistingAppointment,
  Slot,
} from "@/types/booking";
import { BOOKING_RULES, getHoursForDay, type DailyHoursMap } from "./rules";

/**
 * Fixed grid korak za generisanje slotova. Nezavisan od trajanja usluge
 * (Cal.com pattern) — slotovi se uvijek generišu na 30-min granici bez
 * obzira je li usluga 60, 90, 120 ili 180 minuta. Ovo sprečava gubitak
 * kratkih prozora između postojećih termina (npr. 30-min termin završen
 * u 17:30 → sljedeći slot u 17:30 je dostupan).
 */
export const SLOT_INTERVAL_MIN = 30;

export type AvailabilityInput = {
  /** Ponoć ciljanog dana (lokalno vrijeme). */
  date: Date;
  /** Trajanje usluge u minutima. */
  durationMin: number;
  /** Trenutno vrijeme (za min_hours_before i prošlost provjere). */
  now: Date;
  /** Postojeći termini u bazi za taj dan (status ceka/potvrdjen). */
  existing: ExistingAppointment[];
  /** Blokirani datumi iz `blocked_dates`. */
  blocked: BlockedRange[];
  /**
   * Radno vrijeme po danu u sedmici (0=ned..6=sub). Ako nije prosljeđeno,
   * fallback na BOOKING_RULES. Ako je prosljeđeno ali ključ za konkretan
   * dan nedostaje, takođe fallback.
   */
  hoursByWeekday?: DailyHoursMap;
};

/**
 * Pure funkcija koja računa raspoložive slotove za dati dan.
 *
 * Pravila (iz `BOOKING_RULES`):
 *   1. Ako je dan prošao → prazno.
 *   2. Ako je dan > `advance_booking_days` u budućnosti → prazno.
 *   3. Ako je dan blokiran (bilo kojim `BlockedRange`) → prazno.
 *   4. Ako je dan zatvoren (isOpen=false) → prazno.
 *   5. Slotovi idu od `open` vremena u koracima od `SLOT_INTERVAL_MIN` (30 min).
 *      Trajanje usluge se koristi samo za overlap check — posljednji slot mora
 *      završiti ≤ `close` vremenu nakon dodavanja `durationMin`.
 *   6. Svaki slot se odbacuje ako se preklapa sa bilo kojim postojećim terminom.
 *   7. Svaki slot se odbacuje ako je start < `now + min_hours_before`.
 */
export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const { date, durationMin, now, existing, blocked } = input;

  const target = startOfDay(date);
  const today = startOfDay(now);

  // 1. Prošlost
  if (isBefore(target, today)) return [];

  // 2. Advance booking limit
  const daysAhead = differenceInCalendarDays(target, today);
  if (daysAhead > BOOKING_RULES.advance_booking_days) return [];

  // 3. Blokirani datumi
  for (const range of blocked) {
    const from = startOfDay(range.from);
    const to = startOfDay(range.to);
    if (target >= from && target <= to) return [];
  }

  // 4. Radno vrijeme — iz DB mape ako postoji, inače iz BOOKING_RULES
  const weekday = target.getDay();
  const hours = input.hoursByWeekday?.[weekday] ?? getHoursForDay(weekday);
  if (!hours.isOpen) return [];

  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);

  const dayOpen = new Date(target);
  dayOpen.setHours(openH, openM, 0, 0);
  const dayClose = new Date(target);
  dayClose.setHours(closeH, closeM, 0, 0);

  const slots: Slot[] = [];
  let cursor = dayOpen;

  while (true) {
    const end = addMinutes(cursor, durationMin);
    if (end > dayClose) break;

    // 7. min_hours_before
    const hoursFromNow = differenceInHours(cursor, now);
    if (hoursFromNow < BOOKING_RULES.min_hours_before) {
      cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
      continue;
    }

    // 6. Preklapanje sa postojećim
    const overlaps = existing.some(
      (appt) => cursor < appt.end && end > appt.start,
    );
    if (!overlaps) {
      slots.push({ start: new Date(cursor), end });
    }

    cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
  }

  return slots;
}
