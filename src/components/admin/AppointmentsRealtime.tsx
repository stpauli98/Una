"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe-uje na Supabase Realtime kanal za `appointments` tabelu i
 * trigger-uje `router.refresh()` na svaki INSERT/UPDATE/DELETE event.
 * Server component se onda re-render-uje sa svježim podacima.
 *
 * Komponenta ne render-uje ništa vidljivo — UI feedback dolazi iz
 * router.refresh() koji forsira RSC re-fetch.
 *
 * Auth flow:
 *  - `createBrowserClient` čita session iz cookies za regularne queries.
 *  - Realtime sub-klijent ima zasebnu auth state — JWT MORA biti
 *    eksplicitno propagiran preko `realtime.setAuth(token)`.
 *  - Bez toga subscribe ide sa anon JWT-om i server filtrira event-e
 *    (RLS emit-uje samo za `authenticated` rolu).
 *
 * Race-condition guard:
 *  - `onAuthStateChange` može fire-ovati VIŠE PUTA u brzom slijedu
 *    (npr. SIGNED_IN + INITIAL_SESSION oba na mount-u). Drugi pokušaj
 *    `sb.channel(name).on(...)` baca "cannot add postgres_changes after
 *    subscribe()" jer Supabase JS re-koristi channel po imenu i ne
 *    dozvoljava re-bind callback-a nakon subscribe-a.
 *  - Mitigacija: `subscribing` flag → samo jedan subscribe in-flight,
 *    a kad je channel kreiran, dalji auth event-i samo update setAuth.
 */
export function AppointmentsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();
    let channel: RealtimeChannel | null = null;
    let subscribing = false;
    let cancelled = false;

    const handleAuth = async (token: string | undefined) => {
      if (cancelled) return;

      // Token refresh path: kanal već subscribed, samo update auth.
      if (channel) {
        if (token) await sb.realtime.setAuth(token);
        return;
      }

      // Spriječi paralelne subscribe pokušaje (SIGNED_IN + INITIAL_SESSION
      // mogu doći u istom tick-u).
      if (subscribing || !token) return;
      subscribing = true;

      try {
        await sb.realtime.setAuth(token);
        if (cancelled) return;

        const newChannel = sb
          .channel("admin-appointments")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "appointments",
            },
            (payload) => {
              console.log("[realtime] appointments event:", payload.eventType);
              router.refresh();
            },
          )
          .subscribe((status, err) => {
            console.log("[realtime] subscribe status:", status, err ?? "");
          });

        channel = newChannel;
      } finally {
        subscribing = false;
      }
    };

    const {
      data: { subscription: authSub },
    } = sb.auth.onAuthStateChange((event, session) => {
      console.log("[realtime] auth event:", event, !!session);
      void handleAuth(session?.access_token);
    });

    return () => {
      cancelled = true;
      authSub.unsubscribe();
      if (channel) void sb.removeChannel(channel);
    };
  }, [router]);

  return null;
}
