import { BOOKING_RULES } from "@/lib/constants/business";
import type { DailyHours } from "@/types/booking";

export { BOOKING_RULES };

/**
 * Vraća radno vrijeme za dati dan u sedmici (0=nedjelja, 6=subota)
 * iz default booking pravila. Admin može override-ovati preko `working_hours`
 * tabele — ali za default/fallback logiku koristimo ova pravila.
 */
export function getHoursForDay(
  weekday: number,
  rules = BOOKING_RULES,
): DailyHours {
  if ((rules.weekend.days as readonly number[]).includes(weekday)) {
    return {
      open: rules.weekend.open,
      close: rules.weekend.close,
      isOpen: true,
    };
  }
  if ((rules.weekday.days as readonly number[]).includes(weekday)) {
    return {
      open: rules.weekday.open,
      close: rules.weekday.close,
      isOpen: true,
    };
  }
  return { open: "00:00", close: "00:00", isOpen: false };
}

/**
 * Map weekday (0=nedjelja..6=subota) → radno vrijeme za taj dan.
 * Prazne ćelije znače "dan ne postoji u mapi" → fallback na BOOKING_RULES.
 */
export type DailyHoursMap = Record<number, DailyHours>;

/**
 * Pretvara `working_hours` DB redove u `DailyHoursMap`.
 * Tolera redove gdje `open_time`/`close_time` imaju sekunde ("17:00:00")
 * skraćivanjem na "HH:mm".
 */
export function hoursMapFromRows(
  rows: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_open: boolean;
  }>,
): DailyHoursMap {
  const map: DailyHoursMap = {};
  for (const row of rows) {
    map[row.day_of_week] = {
      open: row.open_time.slice(0, 5),
      close: row.close_time.slice(0, 5),
      isOpen: row.is_open,
    };
  }
  return map;
}
