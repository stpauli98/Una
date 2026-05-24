"use client";

import { useEffect, useState } from "react";

/**
 * Hook koji vraća trenutni `Date.now()` i re-render-uje komponentu svake
 * `intervalMs` (default 60 sekundi). Koristi se za "live" indikatore koji
 * trebaju da se osvježe sa protokom vremena bez čekanja na router.refresh
 * ili realtime event — npr. "prošlo" tag na terminu koji upravo prelazi
 * iz future u past.
 *
 * Bez ovog hook-a, komponent koji renderuje `startDate.getTime() < Date.now()`
 * bi ostao u "future" stanju zauvijek dok korisnik ne refresh-uje stranicu.
 */
export function useLiveNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
