"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isGridAligned } from "@/lib/utils/grid";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAuth() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Nije autorizovan");
  return sb;
}

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
    const sb = await requireAuth();
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
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const blockedDateSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  reason: z.string().optional().nullable(),
});

export async function addBlockedDate(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const parsed = blockedDateSchema.parse({
      date_from: String(formData.get("date_from")),
      date_to: String(formData.get("date_to")),
      reason: String(formData.get("reason") ?? "") || null,
    });
    const { error } = await sb.from("blocked_dates").insert(parsed);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeBlockedDate(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb.from("blocked_dates").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
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
    const sb = await requireAuth();
    if (newPassword.length < 8) {
      return { ok: false, error: "Lozinka mora imati najmanje 8 karaktera" };
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
});

export async function createTimeBlock(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const parsed = timeBlockSchema.parse({
      start_time: String(formData.get("start_time")),
      end_time: String(formData.get("end_time")),
      reason: String(formData.get("reason") ?? "") || null,
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
    const { error } = await sb.from("time_blocks").insert(parsed);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteTimeBlock(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb.from("time_blocks").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
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
    const sb = await requireAuth();
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
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
