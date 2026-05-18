"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";

export type SubscribeInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save-uje push subscription za trenutno autentifikovanu admin sesiju.
 *
 * Ako subscription već postoji (unique endpoint), upsert update-uje
 * keys i user_agent — npr. kad browser regeneriše subscription nakon
 * permission reset-a.
 *
 * requireAdmin() vraća autentifikovani sb client; user.id čitamo
 * preko getUser() (admin garantovan iznad).
 */
export async function subscribeAdminToPush(
  input: SubscribeInput,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return { ok: false, error: "Sesija je istekla" };
    }

    const { error } = await sb.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Subscribe failed",
    };
  }
}

/**
 * Briše push subscription po endpoint-u za trenutnu admin sesiju.
 * RLS osigurava da admin može obrisati samo svoju subscription.
 */
export async function unsubscribeAdminFromPush(
  endpoint: string,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unsubscribe failed",
    };
  }
}
