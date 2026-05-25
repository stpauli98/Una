import {
  addDaysToDateStr,
  sarajevoTodayDateStr,
} from "@/lib/utils/day-bounds";
import { parseSarajevoDateTime } from "@/lib/utils/tz";

export type WeeklyExpandInput = {
  /** YYYY-MM-DD prvi datum u seriji (lokalno Sarajevo). */
  startDateStr: string;
  /** HH:MM start (Sarajevo wall-clock). */
  startTimeStr: string;
  /** HH:MM end (Sarajevo wall-clock). */
  endTimeStr: string;
  /** YYYY-MM-DD posljednji datum (uključen) za generisanje. */
  untilDateStr: string;
};

/**
 * Bound za broj generisanih okurenci — zaštita od neograničenog input-a
 * (npr. admin koji unese untilDate sto godina u budućnost). 12 mjeseci ×
 * 5 dana sedmično = 260 okurenci je pragmatičan max.
 */
export const MAX_WEEKLY_OCCURRENCES = 260;

/**
 * Generiše listu sedmičnih okurenci od `startDate` do (uključujući) `untilDate`.
 *
 * TZ-safe: svaki datum se konvertuje iz YYYY-MM-DD string-a preko
 * `parseSarajevoDateTime`, što znači 12:00 u martu (CET) i 12:00 u aprilu
 * (CEST) oba ostaju "12:00 Sarajevo wall-clock" — UTC instant se različito
 * pomjeri preko DST tranzicije, što je željeno ponašanje.
 *
 * Vraća prazan array ako `untilDate < startDate` (no-op input).
 */
export function expandWeeklyTimeBlocks(input: WeeklyExpandInput): Array<{
  start: Date;
  end: Date;
}> {
  const { startDateStr, startTimeStr, endTimeStr, untilDateStr } = input;
  const blocks: Array<{ start: Date; end: Date }> = [];

  let cursor = startDateStr;
  let i = 0;
  while (cursor <= untilDateStr && i < MAX_WEEKLY_OCCURRENCES) {
    blocks.push({
      start: parseSarajevoDateTime(cursor, startTimeStr),
      end: parseSarajevoDateTime(cursor, endTimeStr),
    });
    cursor = addDaysToDateStr(cursor, 7);
    i++;
  }

  return blocks;
}

/**
 * Maksimalan dozvoljen untilDate — danas + 12 mjeseci. Sprečava admin-a da
 * generiše dugačke serije koje su teško editabilne i nepotrebno trose
 * DB rowove.
 */
export function maxUntilDateStr(now: Date = new Date()): string {
  const todayStr = sarajevoTodayDateStr(now);
  return addDaysToDateStr(todayStr, 366);
}
