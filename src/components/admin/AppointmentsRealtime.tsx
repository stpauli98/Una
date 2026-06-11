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
    let subscribing = false;

    const ensureSubscribed = async () => {
      // `subscribing` mora biti sinhron guard: bez njega dva preklopljena
      // poziva (mount + INITIAL_SESSION iz onAuthStateChange) oba prođu
      // `!channel` provjeru dok je prvi još u await-u, a sb.channel()
      // dedup-uje po topic-u pa drugi dobije već subscribe-ovan kanal i
      // `.on()` baci "cannot add postgres_changes callbacks after subscribe()".
      if (cancelled || channel || subscribing) return;
      subscribing = true;

      try {
        const { data: sessionData } = await sb.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          console.warn(
            "[realtime] no session yet — waiting for onAuthStateChange",
          );
          return;
        }
        if (cancelled) return;

        await sb.realtime.setAuth(token);
        if (cancelled) return;

        // StrictMode remount: cleanup-ov removeChannel je fire-and-forget,
        // pa stari kanal istog topic-a može još biti u listi — dedup bi ga
        // vratio umjesto svježeg. Ukloni ga prije kreiranja.
        const stale = sb
          .getChannels()
          .find((c) => c.topic === "realtime:admin-appointments");
        if (stale) {
          await sb.removeChannel(stale);
          if (cancelled) return;
        }

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
      } finally {
        subscribing = false;
      }
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
