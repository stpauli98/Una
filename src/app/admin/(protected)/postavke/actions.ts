"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";

import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
import { z } from "zod";
import { isGridAligned } from "@/lib/utils/grid";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/utils/tz";
import {
  expandWeeklyTimeBlocks,
  maxUntilDateStr,
  MAX_WEEKLY_OCCURRENCES,
} from "@/lib/utils/recurring-blocks";

type ActionResult = { ok: true } | { ok: false; error: string };


const workingHourSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z
    .string()
    .regex(/^\d{2}:(00|30)$/, "Vrijeme mora biti na pun sat ili pola (:00 ili :30)"),
  close_time: z
    .string()
    .regex(/^\d{2}:(00|30)$/, "Vrijeme mora biti na pun sat ili pola (:00 ili :30)"),
  is_open: z.boolean(),
});

export async function updateWorkingHour(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const parsed = workingHourSchema.parse({
      day_of_week: Number(formData.get("day_of_week")),
      open_time: String(formData.get("open_time")),
      close_time: String(formData.get("close_time")),
      is_open: formData.get("is_open") === "on",
    });

    const { error } = await sb
      .from("working_hours")
      .update({
        open_time: parsed.open_time,
        close_time: parsed.close_time,
        is_open: parsed.is_open,
      })
      .eq("day_of_week", parsed.day_of_week);

    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.workingHours);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const blockedDateSchema = z
  .object({
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format mora biti YYYY-MM-DD"),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format mora biti YYYY-MM-DD"),
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((d) => d.date_to >= d.date_from, {
    message: "Datum kraja mora biti isti ili poslije datuma početka",
    path: ["date_to"],
  });

export async function addBlockedDate(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const parsed = blockedDateSchema.parse({
      date_from: String(formData.get("date_from")),
      date_to: String(formData.get("date_to")),
      reason: String(formData.get("reason") ?? "") || null,
    });
    const { error } = await sb.from("blocked_dates").insert(parsed);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.blockedDates);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeBlockedDate(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const { error } = await sb.from("blocked_dates").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.blockedDates);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function changePassword(
  newPassword: string,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    if (newPassword.length < 8) {
      return { ok: false, error: "Lozinka mora imati najmanje 8 karaktera" };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return { ok: false, error: "Lozinka mora sadržavati najmanje jedno veliko slovo" };
    }
    if (!/[a-z]/.test(newPassword)) {
      return { ok: false, error: "Lozinka mora sadržavati najmanje jedno malo slovo" };
    }
    if (!/\d/.test(newPassword)) {
      return { ok: false, error: "Lozinka mora sadržavati najmanje jednu cifru" };
    }
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const timeBlockSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  reason: z.string().max(200).optional().nullable(),
  recurring_weekly: z.boolean().optional(),
  until_date_str: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format mora biti YYYY-MM-DD")
    .optional()
    .nullable(),
});

export async function createTimeBlock(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const parsed = timeBlockSchema.parse({
      start_time: String(formData.get("start_time")),
      end_time: String(formData.get("end_time")),
      reason: String(formData.get("reason") ?? "") || null,
      recurring_weekly: formData.get("recurring_weekly") === "on",
      until_date_str: String(formData.get("until_date_str") ?? "") || null,
    });
    if (new Date(parsed.end_time) <= new Date(parsed.start_time)) {
      return { ok: false, error: "Kraj mora biti poslije početka" };
    }
    const startDate = new Date(parsed.start_time);
    const endDate = new Date(parsed.end_time);
    if (!isGridAligned(startDate) || !isGridAligned(endDate)) {
      return {
        ok: false,
        error: "Vrijeme mora biti na pun sat ili pola (:00 ili :30)",
      };
    }

    // Non-recurring → backward-compatible single insert
    if (!parsed.recurring_weekly) {
      const { error } = await sb.from("time_blocks").insert({
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        reason: parsed.reason,
      });
      if (error) return { ok: false, error: error.message };
      updateTag(ADMIN_CACHE_TAGS.timeBlocks);
      revalidatePath("/admin/postavke");
      return { ok: true };
    }

    // Recurring → expand sedmično do until_date_str
    if (!parsed.until_date_str) {
      return {
        ok: false,
        error: "Recurring blok mora imati 'Do datuma'",
      };
    }
    if (parsed.until_date_str > maxUntilDateStr()) {
      return {
        ok: false,
        error: "Do datuma može biti najviše 12 mjeseci unaprijed",
      };
    }

    // Rekonstruiši YYYY-MM-DD + HH:MM iz ISO start/end u Sarajevo TZ
    const startDateStr = formatInTimeZone(startDate, TZ, "yyyy-MM-dd");
    const startTimeStr = formatInTimeZone(startDate, TZ, "HH:mm");
    const endTimeStr = formatInTimeZone(endDate, TZ, "HH:mm");

    if (parsed.until_date_str < startDateStr) {
      return {
        ok: false,
        error: "Do datuma mora biti isti ili poslije datuma početka",
      };
    }

    const occurrences = expandWeeklyTimeBlocks({
      startDateStr,
      startTimeStr,
      endTimeStr,
      untilDateStr: parsed.until_date_str,
    });

    if (occurrences.length === 0) {
      return { ok: false, error: "Nema okurenci za generisanje" };
    }
    if (occurrences.length > MAX_WEEKLY_OCCURRENCES) {
      return {
        ok: false,
        error: `Preveliki opseg (max ${MAX_WEEKLY_OCCURRENCES} okurenci)`,
      };
    }

    const groupId = crypto.randomUUID();
    const rows = occurrences.map((o) => ({
      start_time: o.start.toISOString(),
      end_time: o.end.toISOString(),
      reason: parsed.reason,
      recurrence_group_id: groupId,
    }));

    const { error } = await sb.from("time_blocks").insert(rows);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.timeBlocks);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteTimeBlock(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const { error } = await sb.from("time_blocks").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.timeBlocks);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Briše SVE time blocks koji pripadaju jednoj recurring seriji
 * (isti recurrence_group_id). Used by "Obriši cijelu seriju" dugmetom
 * u UI-ju kad admin želi da ukloni svaku okurencu odjednom.
 */
export async function deleteTimeBlockSeries(
  groupId: string,
): Promise<ActionResult> {
  try {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        groupId,
      )
    ) {
      return { ok: false, error: "Neispravan group ID" };
    }
    const sb = await requireAdmin();
    const { error } = await sb
      .from("time_blocks")
      .delete()
      .eq("recurrence_group_id", groupId);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.timeBlocks);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const ALLOWED_SETTING_KEYS = [
  "min_hours_before",
  "advance_booking_days",
  "cancellation_hours",
  "break_between_min",
] as const;

export async function updateSetting(
  key: string,
  value: string,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    if (!(ALLOWED_SETTING_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: "Nepoznat ključ podešavanja" };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return { ok: false, error: "Vrijednost mora biti nenegativan broj" };
    }
    // break_between_min mora biti multiple od 30 (grid slot)
    if (key === "break_between_min" && ![0, 30, 60, 90, 120].includes(num)) {
      return {
        ok: false,
        error: "Pauza mora biti 0, 30, 60, 90 ili 120 minuta",
      };
    }
    const { error } = await sb
      .from("settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.settings);
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
