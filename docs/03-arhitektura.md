# 03 · Arhitektura

## Folder struktura — high level

```
up-beauty/
├── src/
│   ├── app/                        # Next.js App Router rute
│   │   ├── (javne stranice)        # /, /usluge, /galerija, /zakazi, itd.
│   │   ├── admin/                  # Admin panel
│   │   │   ├── (protected)/        # Auth-guarded route group
│   │   │   ├── login/              # Public login
│   │   │   └── manifest.webmanifest/ # Admin PWA manifest
│   │   ├── api/                    # API rute (samo availability)
│   │   ├── manifest.webmanifest/   # Public PWA manifest
│   │   ├── opengraph-image.tsx     # Dinamička OG slika
│   │   ├── sitemap.ts              # /sitemap.xml
│   │   └── robots.ts               # /robots.txt
│   ├── components/
│   │   ├── public/                 # Public-facing komponente
│   │   ├── admin/                  # Admin komponente
│   │   ├── booking/                # Booking flow (3 koraka)
│   │   └── ui/                     # Shared primitives
│   ├── lib/
│   │   ├── auth/                   # Admin email whitelist
│   │   ├── booking/                # Availability engine
│   │   ├── cache/                  # Cache tags
│   │   ├── constants/              # Business info, theme
│   │   ├── gallery/                # Gallery categories
│   │   ├── images/                 # Hero images, compress
│   │   ├── push/                   # Web Push (admin)
│   │   ├── seo/                    # JSON-LD builders
│   │   ├── services/               # Services schema
│   │   ├── settings/               # Booking settings parser
│   │   ├── supabase/               # 3 clients: server, admin, client
│   │   └── utils/                  # Formatters, validators, helpers
│   ├── types/                      # TypeScript types
│   │   ├── booking.ts              # Domain types
│   │   └── database.ts             # Generisani Supabase tipovi
│   └── proxy.ts                    # Next.js 16 "proxy" (ex-middleware)
├── supabase/
│   ├── migrations/                 # 18 SQL fajlova
│   ├── seed.sql                    # Storage bucket setup
│   └── config.toml                 # Supabase config za lokalni dev
├── tests/
│   ├── unit/                       # Vitest (304 testa)
│   └── e2e/                        # Playwright (14+ specova)
├── docs/                           # OVA dokumentacija
├── scripts/                        # Bash scripts (test-env setup)
└── public/                         # Static fajlovi (favicon, apple-touch-icon)
```

## Next.js 16 specifičnosti

### `proxy.ts` umjesto `middleware.ts`

Next.js 16 je preimenovao middleware u proxy. Fajl: `src/proxy.ts`.

**Šta radi:**
- Run-uje samo na `/admin/*` rutama (`config.matcher`)
- Osvježava Supabase sesiju iz cookies
- Provjerava da li je user u `ADMIN_EMAILS` listi
- Redirect-uje neautentifikovane na `/admin/login`
- Redirect-uje već ulogovane sa `/admin/login` na dashboard
- **Whitelist javnih admin asseta** (`PUBLIC_ADMIN_PATHS`): `/admin/login`, `/admin/manifest.webmanifest`, `/admin/icon`, `/admin/icon1`, `/admin/apple-icon` — PWA manifest i ikone moraju biti dostupni i bez sesije (browser ih fetch-uje pri "Add to Home Screen")

Detalji: [security/auth.md](./security/auth.md)

### Server Actions

Sve mutation operacije idu kroz **server actions** (ne API rute). Fajlovi su `actions.ts` u svakoj feature folderu:

| Fajl | Funkcije |
|------|----------|
| `src/app/zakazi/actions.ts` | `createAppointment()` — javna rezervacija |
| `src/app/admin/(protected)/termini/actions.ts` | `confirmAppointment()`, `cancelAppointment()`, `markCompleted()`, `createManualAppointment()` |
| `src/app/admin/(protected)/usluge/actions.ts` | Service CRUD |
| `src/app/admin/(protected)/galerija/actions.ts` | Upload, delete |
| `src/app/admin/(protected)/postavke/actions.ts` | Settings, working hours, blocked dates |

**Konvencija:** Svaki action vraća `ActionResult` discriminated union:

```typescript
type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
```

### RSC + Suspense

- **Server komponente** za sve data fetching (čitanje baze direktno)
- **Client komponente** (`"use client"`) samo gdje treba interaktivnost
- `Suspense` boundaries za streaming

### Route groups

`(protected)` u `src/app/admin/(protected)/` je **route group** — ne pojavljuje se u URL-u, samo grupisanje. Sve unutar njega dijeli isti layout sa auth check-om.

## Data flow — booking primjer

Kompletan flow od kad klijent posjeti `/zakazi` do kad termin uđe u bazu:

```
1. GET /zakazi?service=1
   ├── Server component fetcha listu aktivnih usluga (ISR 5 min)
   └── Renderuje BookingFlow client component sa pre-selected service

2. Klijent bira datum
   ├── StepCalendar komponenta fetcha GET /api/availability?date=YYYY-MM-DD&service_id=1
   │
   ├── /api/availability route:
   │   ├── Rate limit check (30/min/IP)
   │   ├── Parallel fetch: appointments, blocked_dates, working_hours, time_blocks, settings
   │   ├── computeAvailableSlots() — pure function
   │   └── Vraća array of {start, end} u ISO formatu
   │
   └── UI prikaže slot dugmad

3. Klijent bira slot, popunjava formu, klikne "Potvrdi"
   ├── createAppointment() server action:
   │   ├── Rate limit (5/min/IP)
   │   ├── Zod validation (bookingFormSchema)
   │   ├── Fetch service iz baze (provjera bookable, active)
   │   ├── isGridAligned() check (mora :00 ili :30)
   │   ├── min_hours_before check (nowSarajevo() vs start)
   │   ├── Race guard SELECT (provjera overlap u "ceka"/"potvrdjen")
   │   ├── crypto.randomUUID() za confirmation_token
   │   ├── INSERT u appointments
   │   └── redirect("/zakazi/uspjesno?token=" + token)

4. /zakazi/uspjesno?token=...
   ├── Server component fetcha appointment by token (UUID, ne ID)
   └── Prikazuje detalje + WhatsApp dugme za potvrdu

5. (Asinhrono) Email primljeno klijentu — Phase 8, TODO
6. Una vidi termin u admin panelu (realtime subscription)
```

## Data flow — admin login

```
1. GET /admin → proxy.ts → user not authenticated
   └── Redirect /admin/login?redirect=/admin

2. /admin/login → user popuni email/password → submit forme
   ├── Supabase auth.signInWithPassword()
   ├── Sets cookies (sb-access-token, sb-refresh-token)
   └── Redirect ka redirect URL

3. GET /admin → proxy.ts
   ├── createServerClient() sa cookies
   ├── sb.auth.getUser() → vraća user
   ├── ADMIN_EMAILS.has(user.email)?
   │   ├── Da → next()
   │   └── Ne → redirect /admin/login (nema admin pristup)
   └── Render admin shell
```

## 3 Supabase klijenta

Različiti klijenti za različite use case-ove:

| Klijent | Fajl | Auth | RLS | Koristi se za |
|---------|------|------|-----|----------------|
| **Server client** | `src/lib/supabase/server.ts` | Anon + cookies | ✅ Poštuje | RSC, server actions sa user kontekstom |
| **Admin client** | `src/lib/supabase/admin.ts` | Service role | ❌ Zaobilazi | Operacije koje trebaju cross-user pristup (race guard, availability) |
| **Browser client** | `src/lib/supabase/client.ts` | Anon | ✅ Poštuje | Klijent-side (login, realtime subscriptions) |

**Pravilo:** `admin.ts` ima `"server-only"` import guard — fail kompajl ako se import-uje u client komponentu.

Detalji: [security/auth.md](./security/auth.md)

## Database schema overview

8 glavnih tabela u `public` schemi:

| Tabela | Šta sadrži | RLS |
|--------|------------|-----|
| `services` | Katalog usluga (ime, cijena, trajanje, kategorija, aktivno) | anon read active, admin full |
| `appointments` | Rezervacije | anon insert (ograničeno), admin full |
| `gallery_images` | Slike u galeriji | public read, admin write |
| `blocked_dates` | Cijeli blokirani dani | public read, admin write |
| `working_hours` | Radno vrijeme po danu (7 redova) | public read, admin write |
| `time_blocks` | Pod-dan blokade (pauze, privatno) | admin (anon ide kroz view) |
| `settings` | Key-value: `min_hours_before`, `advance_booking_days`, itd. | public read, admin write |
| `push_subscriptions` | Web Push subscriptions (admin PWA) | admin only |

Plus 1 view: `time_blocks_public` — bez `reason` polja za anon.

Detalji: [security/rls-policies.md](./security/rls-policies.md), [reference/migrations-list.md](./reference/migrations-list.md)

## Build & deploy flow

```
git push origin main
  └── Vercel detektuje commit
      ├── npm install (deterministic, lock fajl)
      ├── npm run build
      │   ├── TypeScript check (tsc --noEmit kroz Next)
      │   ├── ESLint
      │   ├── Next.js build (Turbopack)
      │   └── Generiše statične + ISR + dynamic rute
      ├── Deploy na Vercel CDN
      └── Production URL active u <1 min
```

Migracije se **ne** push-uju automatski. Treba manual: `supabase db push --linked`. Detalji: [deployment/migrations.md](./deployment/migrations.md)

## Caching strategija

| Layer | Mehanizam | TTL |
|-------|-----------|-----|
| **CDN (Vercel)** | Automatski za statične rute | Beskonačno (do nove revision) |
| **ISR** | `revalidate=300` na `page.tsx` | 5 minuta |
| **`/api/availability`** | `force-dynamic` | 0 (uvijek svježe) |
| **Supabase realtime** | WebSocket push | Live |
| **Slike** | Next.js Image optimization + `minimumCacheTTL=2592000` | 30 dana |
| **Favicon, SVG** | `Cache-Control: public, max-age=2592000, immutable` (next.config.ts) | 30 dana |

### Tag-based invalidacija — `src/lib/cache/`

| Fajl | Šta radi |
|------|----------|
| `cached-queries.ts` | `unstable_cache` wrapperi za skupe query-je (servisi, settings, radno vrijeme) sa cache tagovima |
| `admin-cache-tags.ts` | Centralna lista tagova (npr. `services`, `settings`) — admin mutacija poziva `revalidateTag()` i svi keširani query-ji sa tim tagom se invalidiraju |

Pattern: javne stranice čitaju kroz keširane query-je; admin save → `revalidateTag` → sljedeći request dobija svježe podatke bez čekanja ISR intervala. Unit testovi: `tests/unit/cache-tags.test.ts`.

## Ključni patterns

### `"use server"` actions

```typescript
// src/app/zakazi/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function createAppointment(formData: FormData) {
  const sb = createAdminClient();
  // ... logika
  redirect("/zakazi/uspjesno?token=...");
}
```

### `"server-only"` import guard

```typescript
// src/lib/supabase/admin.ts
import "server-only";
// Sad ako pokušaš import-ovati ovo u client komponentu — kompajl error
```

### Path alias `@/*`

```typescript
import { BUSINESS } from "@/lib/constants/business";
// Ekvivalentno: import { BUSINESS } from "../../../lib/constants/business";
```

### Discriminated union za action result

```typescript
type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const result = await createAppointment(formData);
if (result.ok) {
  // TypeScript zna da result.data postoji
} else {
  // TypeScript zna da result.error postoji
}
```

### Pure function za availability engine

`computeAvailableSlots()` je 100% pure — bez side effects, bez `Date.now()`, bez DB poziva. To je razlog zašto ima 127 unit testova bez mock-ova.

Detalji: [booking-engine/availability.md](./booking-engine/availability.md)

## Sledeće

- Za pregled javnog sajta: [public/README.md](./public/README.md)
- Za pregled admin-a: [admin/README.md](./admin/README.md)
- Za detalje booking engine-a: [booking-engine/README.md](./booking-engine/README.md)
