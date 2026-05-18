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
 * Mount samo u admin (protected) stranicama koje prikazuju termine.
 * Klijent koristi anon key + auth cookie → RLS authenticated policy
 * dozvoljava admin sesiji da prima eventove.
 *
 * Channel se čisti pri unmount-u (cleanup u useEffect-u) tako da ne
 * curi memory na navigaciji između admin tabova.
 */
export function AppointmentsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();

    const channel = sb
      .channel("admin-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [router]);

  return null;
}
