import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  getSarajevoMonthBounds,
  sarajevoTodayDateStr,
} from "@/lib/utils/day-bounds";
import type { ResolvedTerminiPrefs } from "@/lib/utils/admin-prefs";

export type AppointmentsBoundsFilter =
  | { kind: "bounded"; gte: string; lt: string }
  | { kind: "unbounded" };

/**
 * Prevodi resolved Termini prefs u Supabase query bounds. Single source of
 * truth — koristi se za sve query-je u page.tsx (appointments, counts, total).
 *
 * Garancija: svaka opcija (date, range=danas/sedmica/mjesec/svi) koristi
 * Sarajevo TZ. Server TZ (UTC na Vercel-u) ne curi u rezultat.
 *
 * `now` parametar omogućava deterministički unit test (fiksni datum). U
 * produkciji se ne prosljeđuje — default je trenutni moment.
 *
 * Bounds semantika: end je exclusive (`gte/lt` pattern u DB query-ju).
 */
export function buildAppointmentsBoundsFilter(
  resolved: Pick<ResolvedTerminiPrefs, "date" | "range">,
  now: Date = new Date(),
): AppointmentsBoundsFilter {
  if (resolved.date) {
    const b = getSarajevoDayBounds(resolved.date);
    return { kind: "bounded", gte: b.start, lt: b.end };
  }
  const todayStr = sarajevoTodayDateStr(now);
  switch (resolved.range) {
    case "danas": {
      const b = getSarajevoDayBounds(todayStr);
      return { kind: "bounded", gte: b.start, lt: b.end };
    }
    case "sedmica": {
      const b = getSarajevoWeekBounds(todayStr);
      return { kind: "bounded", gte: b.start, lt: b.end };
    }
    case "mjesec": {
      const b = getSarajevoMonthBounds(todayStr);
      return { kind: "bounded", gte: b.start, lt: b.end };
    }
    case "svi":
      return { kind: "unbounded" };
  }
}
