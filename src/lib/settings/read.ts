import { BOOKING_RULES } from "@/lib/constants/business";

export type BookingSettings = {
  minHoursBefore: number;
  advanceBookingDays: number;
  cancellationHours: number;
  breakBetweenMin: number;
};

type SettingsRow = { key: string; value: string };

const DEFAULTS: BookingSettings = {
  minHoursBefore: BOOKING_RULES.min_hours_before,
  advanceBookingDays: BOOKING_RULES.advance_booking_days,
  cancellationHours: BOOKING_RULES.cancellation_hours,
  breakBetweenMin: BOOKING_RULES.break_between_min,
};

const KEY_MAP: Record<string, keyof BookingSettings> = {
  min_hours_before: "minHoursBefore",
  advance_booking_days: "advanceBookingDays",
  cancellation_hours: "cancellationHours",
  break_between_min: "breakBetweenMin",
};

/**
 * Parsira `settings` DB redove u tipizovani objekat.
 * Nedostajući ključevi ili neispravne vrijednosti → fallback na BOOKING_RULES.
 */
export function parseBookingSettings(rows: SettingsRow[]): BookingSettings {
  const result = { ...DEFAULTS };
  for (const row of rows) {
    const prop = KEY_MAP[row.key];
    if (!prop) continue;
    const num = Number(row.value);
    if (Number.isFinite(num) && num >= 0) {
      result[prop] = num;
    }
  }
  return result;
}
