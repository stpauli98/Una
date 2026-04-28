import { addMinutes, differenceInHours } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type {
  BlockedRange,
  ExistingAppointment,
  Slot,
} from "@/types/booking";
import { BOOKING_RULES, getHoursForDay, type DailyHoursMap } from "./rules";
import type { BookingSettings } from "@/lib/settings/read";
import { BUSINESS } from "@/lib/constants/business";

const TZ = BUSINESS.timezone;

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
   * Sub-day vremenski blokovi iz `time_blocks` tabele. Tretiraju se
   * identično kao postojeći termini u overlap check-u.
   */
  blockedTimes?: ExistingAppointment[];
  /**
   * Radno vrijeme po danu u sedmici (0=ned..6=sub). Ako nije prosljeđeno,
   * fallback na BOOKING_RULES. Ako je prosljeđeno ali ključ za konkretan
   * dan nedostaje, takođe fallback.
   */
  hoursByWeekday?: DailyHoursMap;
  /**
   * Ako true, preskače `min_hours_before` provjeru. Koristi se za admin
   * booking — Una treba moći da zakaže termin i za danas, bez 24h limita.
   */
  skipMinHoursBefore?: boolean;
  /**
   * Booking pravila iz `settings` tabele. Ako nije prosljeđeno,
   * koristi BOOKING_RULES konstante kao fallback.
   */
  settings?: BookingSettings;
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

  // Sarajevo wall-clock date stringovi (ne UTC) — konzistentno na bilo kojem
  // server TZ-u (lokalni Sarajevo dev, Vercel UTC). `getDay()`/`setHours()` na
  // sirovom Date objektu koristi server-local TZ što je lomilo logiku na UTC
  // serveru — pomjeralo dan unazad za jedan.
  const targetDateStr = formatInTimeZone(date, TZ, "yyyy-MM-dd");
  const todayDateStr = formatInTimeZone(now, TZ, "yyyy-MM-dd");

  // 1. Prošlost — string compare na YYYY-MM-DD je leksikografski ispravan
  if (targetDateStr < todayDateStr) return [];

  // 2. Advance booking limit — broj kalendarskih dana razlike u Sarajevo TZ
  const advanceDays = input.settings?.advanceBookingDays ?? BOOKING_RULES.advance_booking_days;
  const targetMidnightUtc = fromZonedTime(`${targetDateStr}T00:00:00`, TZ);
  const todayMidnightUtc = fromZonedTime(`${todayDateStr}T00:00:00`, TZ);
  const daysAhead = Math.round(
    (targetMidnightUtc.getTime() - todayMidnightUtc.getTime()) / 86_400_000,
  );
  if (daysAhead > advanceDays) return [];

  // 3. Blokirani datumi — usporedi Sarajevo date stringove
  for (const range of blocked) {
    const fromStr = formatInTimeZone(range.from, TZ, "yyyy-MM-dd");
    const toStr = formatInTimeZone(range.to, TZ, "yyyy-MM-dd");
    if (targetDateStr >= fromStr && targetDateStr <= toStr) return [];
  }

  // 4. Radno vrijeme — weekday u Sarajevo TZ (na UTC serveru bez ovog
  // koraka, getDay() je vraćao prethodni dan jer je interno UTC bilo
  // 22:00 prethodnog dana)
  const weekday = toZonedTime(date, TZ).getDay();
  const hours = input.hoursByWeekday?.[weekday] ?? getHoursForDay(weekday);
  if (!hours.isOpen) return [];

  // dayOpen/dayClose: konstruiši kao Sarajevo wall-clock, vrati real UTC.
  // Slot ISO će biti tačan i kad se klijent renderuje u bilo kojoj TZ.
  const dayOpen = fromZonedTime(`${targetDateStr}T${hours.open}:00`, TZ);
  const dayClose = fromZonedTime(`${targetDateStr}T${hours.close}:00`, TZ);

  const slots: Slot[] = [];
  let cursor = dayOpen;

  while (true) {
    const end = addMinutes(cursor, durationMin);
    if (end > dayClose) break;

    // 7. min_hours_before (preskačemo za admin booking)
    if (!input.skipMinHoursBefore) {
      const minHours = input.settings?.minHoursBefore ?? BOOKING_RULES.min_hours_before;
      const hoursFromNow = differenceInHours(cursor, now);
      if (hoursFromNow < minHours) {
        cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
        continue;
      }
    }

    // 6. Preklapanje sa postojećim terminima ili sub-day time blokovima
    // break_between_min proširuje efektivni kraj svakog termina
    const breakMin = input.settings?.breakBetweenMin ?? 0;
    const allBlocking = [...existing, ...(input.blockedTimes ?? [])];
    const overlaps = allBlocking.some((item) => {
      const effectiveEnd =
        breakMin > 0 ? addMinutes(item.end, breakMin) : item.end;
      return cursor < effectiveEnd && end > item.start;
    });
    if (!overlaps) {
      slots.push({ start: new Date(cursor), end });
    }

    cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
  }

  return slots;
}
