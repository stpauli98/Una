import "server-only";
import { getConfiguredWebPush } from "@/lib/push/vapid";
import { createAdminClient } from "@/lib/supabase/admin";
import { sarajevoDateStr } from "@/lib/utils/day-bounds";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type NewAppointmentInput = {
  /** ID termina — za deep-link koji fokusira tačan termin u admin panelu. */
  id: number;
  clientName: string;
  serviceName: string;
  startTime: Date;
};

/**
 * Formatira push payload za novu rezervaciju.
 *
 * Vrijeme prikazujemo u Sarajevo timezoni jer je sve poslovanje lokalno.
 * URL je deep-link `/admin/termini?date=&focus=<id>` (isti kao u admin
 * email-u) — notificationclick handler u SW navigira na njega, pa klik na
 * notifikaciju vodi na tačan termin te osobe, a ne samo na listu.
 */
export function buildNewAppointmentPayload(
  input: NewAppointmentInput,
): PushPayload {
  const time = new Intl.DateTimeFormat("sr-Latn-BA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sarajevo",
  }).format(input.startTime);

  return {
    title: "Nova rezervacija",
    body: `${input.clientName} — ${input.serviceName} u ${time}`,
    url: `/admin/termini?date=${sarajevoDateStr(input.startTime)}&focus=${input.id}`,
  };
}

/**
 * Šalje push notifikaciju svim aktivnim admin subscriptions-ima.
 *
 * Best-effort: ako jedan endpoint failuje (gone, 410), tiho ga obriše.
 * Ako ENV vars fale ili web-push baci, log i nastavi — push fail NE
 * smije blokirati booking flow.
 *
 * Koristi service role klijent jer treba čitati subscriptions svih
 * admina (RLS bi vratio samo za current session user, a ovaj util se
 * poziva iz public booking flow-a gdje nema admin sesije).
 */
export async function sendAdminPushNotification(
  payload: PushPayload,
): Promise<void> {
  let webpush: ReturnType<typeof getConfiguredWebPush>;
  try {
    webpush = getConfiguredWebPush();
  } catch (err) {
    console.error("[push] VAPID not configured, skipping:", err);
    return;
  }

  const sb = createAdminClient();
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("[push] failed to load subscriptions:", error.message);
    return;
  }
  if (!subs || subs.length === 0) {
    return;
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        // Update last_used_at — best-effort, ne čekaj.
        void sb
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (status === 404 || status === 410) {
          // Subscription gone (endpoint unsubscribed/expired) — cleanup.
          await sb.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error(
            `[push] send failed for ${sub.endpoint}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }),
  );
}
