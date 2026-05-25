"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { getConfiguredWebPush } from "@/lib/push/vapid";

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
 * Šalje test push notifikaciju SAMO trenutnoj admin sesiji (svom user_id-u).
 * Razlika od `sendAdminPushNotification` koji ide svim adminima — test je
 * lično, da admin verifikuje da push stiže na njegov uređaj prije nego
 * što stigne prva live rezervacija.
 *
 * Best-effort: ako je subscription stara (404/410), tiho briše. Vraća
 * agregirani rezultat — `ok: true` ako je BAR jedna subscription primila
 * notifikaciju.
 */
export async function sendTestPushToCurrentAdmin(): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return { ok: false, error: "Sesija je istekla" };
    }

    let webpush: ReturnType<typeof getConfiguredWebPush>;
    try {
      webpush = getConfiguredWebPush();
    } catch {
      return {
        ok: false,
        error:
          "Push servis nije konfigurisan na serveru (VAPID env vars). Kontaktiraj dev tim.",
      };
    }

    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
    if (!subs || subs.length === 0) {
      return {
        ok: false,
        error:
          "Nema aktivne subscription na ovom nalogu. Uključi obavještenja prvo.",
      };
    }

    const payload = JSON.stringify({
      title: "Test obavještenje",
      body: "Push notifikacije rade. Dobijaćeš ovakvu poruku za svaku novu rezervaciju.",
      url: "/admin/postavke",
    });

    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
          void sb
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", sub.id);
          return { ok: true as const };
        } catch (err: unknown) {
          const status =
            typeof err === "object" && err !== null && "statusCode" in err
              ? (err as { statusCode: number }).statusCode
              : 0;
          if (status === 404 || status === 410) {
            await sb.from("push_subscriptions").delete().eq("id", sub.id);
            return { ok: false as const, gone: true };
          }
          return {
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      revalidatePath("/admin/postavke");
      return { ok: true };
    }

    const goneAll = results.every((r) => !r.ok && r.gone);
    if (goneAll) {
      return {
        ok: false,
        error:
          "Subscription je istekla i automatski obrisana. Uključi obavještenja ponovo.",
      };
    }

    const firstErr = results.find(
      (r): r is { ok: false; error: string } => !r.ok && "error" in r,
    );
    return {
      ok: false,
      error: firstErr?.error ?? "Slanje nije uspjelo",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Test push failed",
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
