/**
 * TZ-aware helperi za parametrizaciju lista termina po danu.
 *
 * Sarajevo koristi CET (UTC+1) zimi i CEST (UTC+2) ljeti.
 * Sve kalkulacije ponoći moraju biti svjesne DST tranzicija.
 *
 * Koristiti za DB filtriranje:
 *   `gte("start_time", start) AND lt("start_time", end)`
 */

import { formatInTimeZone } from "date-fns-tz";
import { atSarajevo, parseDateSarajevo, TZ } from "@/lib/utils/tz";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(s: string): void {
  if (!ISO_DATE_RE.test(s)) {
    throw new Error(`Neispravan datum format (očekivano YYYY-MM-DD): "${s}"`);
  }
  // Validacija stvarnog datuma (npr. odbij 2026-13-01)
  const [y, m, d] = s.split("-").map(Number);
  const date = atSarajevo(y, m, d, 0, 0);
  const back = formatInTimeZone(date, TZ, "yyyy-MM-dd");
  if (back !== s) {
    throw new Error(`Datum ne postoji u kalendaru: "${s}"`);
  }
}

/**
 * Vraća Sarajevo dnevne granice (start = ponoć, end = sljedeća ponoć)
 * kao ISO UTC stringove. Ispravno radi pri DST tranzicijama (CET/CEST).
 *
 * Koristi se za DB filtriranje: `gte("start_time", start) AND lt("start_time", end)`.
 */
export function getSarajevoDayBounds(dateStr: string): {
  start: string;
  end: string;
} {
  assertIsoDate(dateStr);
  const start = parseDateSarajevo(dateStr);
  // Podne kao baza — daleko od bilo koje DST tranzicije (koje su uvijek 02:00/03:00).
  // Dodaj 24h da dođeš sigurno u sljedeći dan, pa format-uj i izračunaj ponoć.
  const [y, m, d] = dateStr.split("-").map(Number);
  const baseNoon = atSarajevo(y, m, d, 12, 0);
  const nextDay = new Date(baseNoon.getTime() + 24 * 60 * 60 * 1000);
  const nextDateStr = formatInTimeZone(nextDay, TZ, "yyyy-MM-dd");
  const [ny, nm, nd] = nextDateStr.split("-").map(Number);
  const end = atSarajevo(ny, nm, nd, 0, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Vraća Sarajevo sedmične granice (ponedjeljak 00:00 — sljedeći ponedjeljak 00:00)
 * kao ISO UTC stringove. End je exclusive (koristi se sa `gte/lt` u DB query-ju).
 *
 * Input: bilo koji YYYY-MM-DD dateStr unutar te sedmice. Funkcija sama nađe
 * ponedjeljak. DST-safe (sva aritmetika ide preko podneva kao bazne tačke).
 */
export function getSarajevoWeekBounds(dateStr: string): {
  start: string;
  end: string;
} {
  assertIsoDate(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  // Podne kao baza — daleko od DST tranzicija (uvijek 02:00/03:00)
  const noon = atSarajevo(y, m, d, 12, 0);
  // ISO dan: 1=Mon, 7=Sun
  const isoDay = parseInt(formatInTimeZone(noon, TZ, "i"), 10);
  // Pomak unazad do ponedjeljka kroz podne
  const mondayNoon = new Date(
    noon.getTime() - (isoDay - 1) * 24 * 60 * 60 * 1000,
  );
  const mondayDateStr = formatInTimeZone(mondayNoon, TZ, "yyyy-MM-dd");
  // Sljedeći ponedjeljak = mondayNoon + 7 dana, pa format → datum
  const nextMondayNoon = new Date(
    mondayNoon.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
  const nextMondayDateStr = formatInTimeZone(
    nextMondayNoon,
    TZ,
    "yyyy-MM-dd",
  );
  // Ponoć iz date string-ova (zna DST tačno)
  const [my, mm, md] = mondayDateStr.split("-").map(Number);
  const [ny, nm, nd] = nextMondayDateStr.split("-").map(Number);
  return {
    start: atSarajevo(my, mm, md, 0, 0).toISOString(),
    end: atSarajevo(ny, nm, nd, 0, 0).toISOString(),
  };
}

/**
 * Vraća Sarajevo mjesečne granice (1. dan u mjesecu 00:00 — 1. sljedećeg 00:00)
 * kao ISO UTC stringove. End je exclusive.
 *
 * Input: bilo koji YYYY-MM-DD dateStr unutar tog mjeseca. Ispravno radi za
 * sve dužine mjeseci (28/29/30/31) i decembar→januar prelaz. DST-safe.
 */
export function getSarajevoMonthBounds(dateStr: string): {
  start: string;
  end: string;
} {
  assertIsoDate(dateStr);
  const [y, m] = dateStr.split("-").map(Number);
  // Prvi dan ovog mjeseca, ponoć u Sarajevu
  const start = atSarajevo(y, m, 1, 0, 0);
  // Prvi dan sljedećeg mjeseca: (y, m+1, 1) sa wraparound za decembar
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = atSarajevo(nextY, nextM, 1, 0, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * YYYY-MM-DD u Sarajevo TZ za dati `now` (default: trenutno vrijeme).
 * Koristi se kao default kad ?date= query param nije setovan.
 */
export function sarajevoTodayDateStr(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

/**
 * Dodaje (ili oduzima) `days` na YYYY-MM-DD string. Vraća rezultat kao
 * YYYY-MM-DD. Ispravan preko mjesec/godina granica i DST tranzicija.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  assertIsoDate(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  // Podne kao baza — daleko od bilo koje DST tranzicije (koje su uvijek 02:00/03:00)
  const base = atSarajevo(y, m, d, 12, 0);
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatInTimeZone(shifted, TZ, "yyyy-MM-dd");
}
