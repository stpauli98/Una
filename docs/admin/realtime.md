# Admin: Realtime — live update termina

**Komponenta:** `src/components/admin/AppointmentsRealtime.tsx`

Live sync kad se appointments tabela promijeni.

## Šta omogućava

| Use case | Šta se desi |
|----------|-------------|
| Klijent rezerviše termin | Una vidi novi termin za 1-2s bez refresh-a |
| Una promijeni status iz drugog tab-a | Ostali tab-ovi auto-sync |
| Klijent klikne na uspjesno (insert) | Termin se pojavi u admin listi |

## Implementacija

Supabase Realtime kroz `postgres_changes` channel:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AppointmentsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",         // INSERT, UPDATE, DELETE
          schema: "public",
          table: "appointments",
        },
        () => {
          router.refresh();  // re-fetch server data
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [router]);

  return null;
}
```

Komponenta je "headless" — nema UI, samo subscription.

Render-uje se u `src/app/admin/(protected)/termini/page.tsx` (i potencijalno u dashboard-u).

## Supabase setup

### Migracija

**Fajl:** `supabase/migrations/20260518000000_realtime_appointments.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
```

Bez ovoga, realtime channel ne dobija events za `appointments` tabelu.

### RLS

Realtime poštuje RLS:
- Anon user: ne dobija events (anon nema SELECT na appointments)
- Authenticated admin (Una): dobija sve events

## `router.refresh()`

Next.js 14+ API. Kad pozvan u client komponenti:
1. Server komponenta se re-fetcha (`force-dynamic` u admin page-u)
2. Novi HTML se streamuje na klijent
3. React reconciliation
4. UI update

**Bez fetch boli** — Next.js caching i React state se očuvaju.

## Performance

| Optimizacija | Implementacija |
|--------------|----------------|
| **Debouncing** | Nije implementirano (TBD ako bude potreba) |
| **Selective channels** | Sve events kroz jedan channel (jednostavnost) |
| **Background tab** | Browser pauzira WebSocket-e u background tab-u — OK |

## Reconnect logic

Supabase JS klijent automatski reconnect-uje pri konekciji break:

- Network down → reconnect attempt
- Tab background, vraćen → ack ping
- Server restart → re-subscribe

Una ne mora ništa raditi.

## Limiti (Supabase Free tier)

| Resource | Limit |
|----------|-------|
| Concurrent connections | 200 (više nego dovoljno za 1 admin) |
| Messages per second | 100 (overflow se drop-uje) |
| Channel size | 4MB |

Sa 1 admin korisnikom i ~10 changes per day, ovo nikad nije problem.

## Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Konekcija prekinuta tokom subscription-a | Auto-reconnect |
| Server restart | Re-subscribe na resume |
| Una zatvori tab dok pending change | Sljedeća sesija dobija update odmah |
| Više tab-ova istovremeno | Svi sync-uju |
| Mobile background tab (PWA) | WebSocket suspended dok je tab background |

## Push vs Realtime

Realtime je za **dok je Una u admin panelu**. Kad zatvori tab — više ne dobija notifikacije.

Push notifikacije su za **kad nije u admin-u** (Una vidi notifikaciju na telefonu).

Komplementarne tehnologije, ne overlap.

Detalji: [pwa-push.md](./pwa-push.md)
