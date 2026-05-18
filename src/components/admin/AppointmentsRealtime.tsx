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
 * Bitno o auth propagaciji:
 *  - `createBrowserClient` čita session iz cookies za regularne queries,
 *    ALI realtime sub-klijent ima zasebnu auth state.
 *  - Subscribe sa anon JWT-om → server filtrira postgres_changes
 *    event-e jer RLS emit-uje samo za `authenticated` rolu.
 *  - Rešenje: `realtime.setAuth(token)` PRIJE subscribe-a + listen-ovati
 *    na `onAuthStateChange` da update-uje token kad se session refresh-uje.
 *
 * Diagnostic logovi su namjerno tu — ako neko sutra javi "ne radi mi",
 * konzola odmah kaže gdje pada.
 */
export function AppointmentsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const ensureSubscribed = async () => {
      if (cancelled || channel) return;

      const { data: sessionData } = await sb.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        console.warn(
          "[realtime] no session yet — waiting for onAuthStateChange",
        );
        return;
      }

      await sb.realtime.setAuth(token);

      channel = sb
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
    };

    // Prvi pokušaj odmah — session bi obično trebao biti dostupan
    // pošto admin layout već radi sb.auth.getUser() pri SSR-u.
    void ensureSubscribed();

    // Backup: ako session nije bila tu pri prvom pokušaju (PWA hydration
    // race), onAuthStateChange će fire-ovati čim je dostupna.
    const {
      data: { subscription: authSub },
    } = sb.auth.onAuthStateChange((event, session) => {
      console.log("[realtime] auth event:", event, !!session);
      if (session && !channel) {
        void ensureSubscribed();
      } else if (session && channel) {
        // Token refresh — update realtime auth bez re-subscribe-a.
        void sb.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      cancelled = true;
      authSub.unsubscribe();
      if (channel) void sb.removeChannel(channel);
    };
  }, [router]);

  return null;
}
