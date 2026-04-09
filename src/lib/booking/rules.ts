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
