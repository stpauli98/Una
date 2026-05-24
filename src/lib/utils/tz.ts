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

import { fromZonedTime } from "date-fns-tz";
import { BUSINESS } from "@/lib/constants/business";

export const TZ = BUSINESS.timezone; // "Europe/Sarajevo"

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

/**
 * Parsira (YYYY-MM-DD, HH:MM) par kao wall-clock vrijeme u Sarajevo TZ.
 *
 * Koristi se kad UI komponente (HTML <input type="date"> + time select)
 * trebaju snimiti Date u bazu. Bare `new Date(`${date}T${time}:00`)`
 * koristi browser-local TZ što daje pogrešan UTC ako admin nije u
 * Europe/Sarajevo (vidi `tests/unit/tz.test.ts`).
 *
 * "2026-06-15", "18:00" → Date koji predstavlja 18:00 CEST
 * (interno: 2026-06-15T16:00:00.000Z u junu)
 */
export function parseSarajevoDateTime(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TZ);
}
