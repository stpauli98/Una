import { SLOT_INTERVAL_MIN } from "@/lib/booking/availability";

/**
 * Provjeri da li je datum poravnan sa booking grid-om (minuta mora biti
 * 0 ili 30). Koristi se kao defense-in-depth u server action-ima —
 * UI dropdown-i već ograničavaju izbor, ali ovo štiti od curl/DevTools.
 */
export function isGridAligned(date: Date): boolean {
  return date.getMinutes() % SLOT_INTERVAL_MIN === 0;
}

/**
 * Baca grešku ako datum nije na 30-min gridu.
 */
export function assertGridAligned(date: Date): void {
  if (!isGridAligned(date)) {
    throw new Error(
      `Vrijeme mora biti na :00 ili :30 (dobijeno :${String(date.getMinutes()).padStart(2, "0")})`,
    );
  }
}
