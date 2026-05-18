import {
  endOfMonth,
  startOfMonth,
  eachDayOfInterval,
  format,
} from "date-fns";
import {
  computeAvailableSlots,
  type AvailabilityInput,
} from "./availability";
import type { DailyHoursMap } from "./rules";

type Existing = AvailabilityInput["existing"];
type Blocked = AvailabilityInput["blocked"];
type BlockedTimes = AvailabilityInput["blockedTimes"];
type Settings = AvailabilityInput["settings"];

const CLOSED_DAY = { open: "00:00", close: "00:00", isOpen: false } as const;

/**
 * Nadopunjuje `hoursByWeekday` mapu sa zatvorenim danima za sve dane koji
 * nisu eksplicitno definirani. Ovo sprečava fallback na `BOOKING_RULES`
 * unutar `computeAvailableSlots` za dane koji nisu u radnom kalendaru.
 */
function fillClosedDays(map: DailyHoursMap | undefined): DailyHoursMap {
  const result: DailyHoursMap = {};
  for (let d = 0; d <= 6; d++) {
    result[d] = map?.[d] ?? CLOSED_DAY;
  }
  return result;
}

export type MonthAvailabilityInput = {
  /** Year, e.g. 2026 */
  year: number;
  /** Month number 1-12 (kalendar month, ne JS month index) */
  month: number;
  durationMin: number;
  now: Date;
  existing: Existing;
  blocked: Blocked;
  /** Radno vrijeme po danu (0=ned..6=sub). Dani koji nedostaju se tretiraju
   *  kao zatvoreni — nema fallback na BOOKING_RULES konstante. */
  hoursByWeekday: DailyHoursMap;
  blockedTimes: BlockedTimes;
  settings: Settings;
  /** Set when this is invoked from admin context — bypassa min_hours_before */
  skipMinHoursBefore?: boolean;
};

/**
 * Za svaki dan u mjesecu, vrati `true` ako postoji barem jedan slobodan
 * slot za zadanu uslugu, ili `false` ako je dan popunjen / blokiran /
 * van radnog vremena.
 *
 * Pure funkcija — DB query rezultati se prosljeđuju kao argumenti.
 * Endpoint koji je poziva mora dohvatiti appointments/blocked/hours/
 * time_blocks/settings JEDNOM za cijeli mjesec pa proslijediti ovoj
 * funkciji, koja onda iterira po danima.
 *
 * Performance: 28-31 poziva `computeAvailableSlots` per request.
 * Svaki poziv je in-memory iteracija; tipično <50ms za pun mjesec.
 */
export function getMonthAvailability(
  input: MonthAvailabilityInput,
): Record<string, boolean> {
  const firstDayOfMonth = new Date(Date.UTC(input.year, input.month - 1, 1));
  const days = eachDayOfInterval({
    start: startOfMonth(firstDayOfMonth),
    end: endOfMonth(firstDayOfMonth),
  });

  const result: Record<string, boolean> = {};
  // Popuni sve nedostajuće dane kao zatvorene da bismo spriječili fallback
  // unutar computeAvailableSlots na globalne BOOKING_RULES weekday/weekend
  // rasporede koji mogu biti različiti od stvarnog radnog kalendara.
  const hoursByWeekday = fillClosedDays(input.hoursByWeekday);

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    const slots = computeAvailableSlots({
      date: day,
      durationMin: input.durationMin,
      now: input.now,
      existing: input.existing,
      blocked: input.blocked,
      hoursByWeekday,
      blockedTimes: input.blockedTimes,
      skipMinHoursBefore: input.skipMinHoursBefore ?? false,
      settings: input.settings,
    });
    result[dateStr] = slots.length > 0;
  }

  return result;
}
