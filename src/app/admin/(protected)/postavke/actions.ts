"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  open_time: z.string().regex(/^\d{2}:\d{2}$/),
  close_time: z.string().regex(/^\d{2}:\d{2}$/),
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
