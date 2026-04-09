"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAuth() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    throw new Error("Nije autorizovan");
  }
  return sb;
}

export async function confirmAppointment(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb
      .from("appointments")
      .update({
        status: "potvrdjen",
        confirmation_sent_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    // TODO(Phase 8): sendConfirmationEmail(id) — sa fallbackom ako nema email-a

    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cancelAppointment(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb
      .from("appointments")
      .update({ status: "otkazan" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function markCompleted(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb
      .from("appointments")
      .update({ status: "zavrsen" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
