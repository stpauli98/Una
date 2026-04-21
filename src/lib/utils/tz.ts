/**
 * Timezone helpers — standardizuje sve operacije na Europe/Sarajevo.
 *
 * Vercel serverless radi u UTC. Bez eksplicitnog TZ, `new Date()` i
 * `startOfDay()` daju UTC midnight umjesto Sarajevo midnight. Ovo uzrokuje
 * pogrešne slotove na produkciji.
 *
 * Svi datum/vrijeme kalkulacije u booking engine-u moraju koristiti ove
 * helpere umjesto golih `new Date()` i `parseISO()`.
 */

import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { BUSINESS } from "@/lib/constants/business";

export const TZ = BUSINESS.timezone; // "Europe/Sarajevo"

/**
 * Trenutno vrijeme u Sarajevo timezone-u.
 * Zamjena za `new Date()` u svim booking kalkulacijama.
 */
export function nowSarajevo(): Date {
  return toZonedTime(new Date(), TZ);
}

/**
 * Parsira YYYY-MM-DD string kao ponoć u Sarajevo timezone-u.
 * Zamjena za `startOfDay(parseISO(dateStr))` u availability API.
 *
 * "2026-04-28" → Date objekt koji predstavlja 2026-04-28 00:00:00 CET
 * (interno: 2026-04-27T22:00:00Z za CEST)
 */
export function parseDateSarajevo(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, TZ);
}

/**
 * Kreira Date za specifican sat/minut u Sarajevo timezone-u.
 * Korisno za testove i seedovanje.
 *
 * atSarajevo(2026, 4, 28, 17, 0) → 28. april 2026. 17:00 CET
 */
export function atSarajevo(
  year: number,
  month: number,
  day: number,
  hour: number,
  min = 0,
): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`;
  return fromZonedTime(local, TZ);
}
