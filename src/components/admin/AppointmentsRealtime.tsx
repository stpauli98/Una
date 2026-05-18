"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe-uje na Supabase Realtime kanal za `appointments` tabelu i
 * trigger-uje `router.refresh()` na svaki INSERT/UPDATE/DELETE event.
 * Server component se onda re-render-uje sa svježim podacima.
 *
 * Komponenta ne render-uje ništa vidljivo — UI feedback dolazi iz
 * router.refresh() koji forsira RSC re-fetch.
 *
 * BITNO: Realtime klijent treba authenticated JWT (ne anon) da bi
 * dobio eventove. RLS na appointments emit-uje samo za `authenticated`
 * rolu. createBrowserClient čita session iz cookies, ALI realtime
 * sub-klijent ima svoju internu auth state koja se setuje ručno preko
 * `setAuth(token)`. Bez tog koraka, subscribe ide sa anon JWT-om i
 * server odbija postgres_changes event-e.
 *
 * Logujemo status callback u dev/staging tako da se brzo vidi gdje
 * fail-uje (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED).
 */
export function AppointmentsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;

    const setup = async () => {
      // Setuj realtime auth eksplicitno iz session-a — ovo je glavni
      // popravak. createBrowserClient ne propagira automatski JWT na
      // realtime sub-klijent. Ako session nema (no auth), refresh
      // session jednom — moguć race kad PWA tek hidratira.
      const { data: sessionData } = await sb.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        await sb.realtime.setAuth(accessToken);
      } else {
        console.warn(
          "[realtime] no session at subscribe time — events will be filtered out by RLS",
        );
      }

      if (cancelled) return;

      const channel = sb
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

      return channel;
    };

    const channelPromise = setup();

    return () => {
      cancelled = true;
      void channelPromise.then((channel) => {
        if (channel) void sb.removeChannel(channel);
      });
    };
  }, [router]);

  return null;
}
