import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import { TZ } from "@/lib/utils/tz";

export interface SlotValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Dan u sedmici za Sarajevo wall-clock (0=nedjelja..6=subota) — ista
 * konvencija kao `working_hours.day_of_week` i availability engine.
 */
export function sarajevoDayOfWeek(date: Date): number {
  return toZonedTime(date, TZ).getDay();
}

/** Postgres `time` round-trip-uje sa sekundama ("05:00:00") → "05:00". */
const toHHmm = (time: string) => time.slice(0, 5);

export function isSlotWithinWorkingHours(
  openTime: string,
  closeTime: string,
  slotStart: string,
  slotEnd: string,
): boolean {
  return slotStart >= toHHmm(openTime) && slotEnd <= toHHmm(closeTime);
}

export function isDateBlocked(
  dateStr: string,
  blocked: { date_from: string; date_to: string }[],
): boolean {
  return blocked.some((b) => dateStr >= b.date_from && dateStr <= b.date_to);
}

export function doTimesOverlap(
  start: Date,
  end: Date,
  blocks: { start: Date; end: Date }[],
): boolean {
  return blocks.some((b) => start < b.end && end > b.start);
}

export async function validateSlotServerSide(
  sb: SupabaseClient,
  start: Date,
  end: Date,
): Promise<SlotValidationResult> {
  const dayOfWeek = sarajevoDayOfWeek(start);
  const dateStr = formatInTimeZone(start, TZ, "yyyy-MM-dd");
  const slotStartTime = formatInTimeZone(start, TZ, "HH:mm");
  const slotEndTime = formatInTimeZone(end, TZ, "HH:mm");

  const dayStart = start.toISOString();
  const dayEnd = addDays(start, 1).toISOString();

  const [hoursRes, blockedRes, timeBlocksRes] = await Promise.all([
    sb
      .from("working_hours")
      .select("open_time,close_time,is_open")
      .eq("day_of_week", dayOfWeek)
      .maybeSingle(),
    sb.from("blocked_dates").select("date_from,date_to"),
    sb
      .from("time_blocks")
      .select("start_time,end_time")
      .lt("start_time", dayEnd)
      .gt("end_time", dayStart),
  ]);

  if (hoursRes.error || blockedRes.error || timeBlocksRes.error) {
    return { valid: false, reason: "Greška pri provjeri raspoloživosti" };
  }

  const hours = hoursRes.data;
  if (!hours || !hours.is_open) {
    return { valid: false, reason: "Salon ne radi tog dana" };
  }

  if (!isSlotWithinWorkingHours(hours.open_time, hours.close_time, slotStartTime, slotEndTime)) {
    return { valid: false, reason: "Termin je van radnog vremena" };
  }

  if (isDateBlocked(dateStr, blockedRes.data ?? [])) {
    return { valid: false, reason: "Datum je blokiran" };
  }

  const blocks = (timeBlocksRes.data ?? [])
    .filter((t) => t.start_time && t.end_time)
    .map((t) => ({ start: new Date(t.start_time!), end: new Date(t.end_time!) }));

  if (doTimesOverlap(start, end, blocks)) {
    return { valid: false, reason: "Termin se preklapa sa blokirano vrijeme" };
  }

  return { valid: true };
}
