# UP Makeup

Produkcioni sajt za beauty studio u Gradišci — Una Peranović. Sadrži marketinške stranice, online zakazivanje, admin panel i automatska email obavještenja.

**Stack:** Next.js 16 (App Router, Turbopack, src/) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · Resend · Vercel · Vitest + Playwright

---

## Brzi start (razvoj)

Preduslovi:
- Node.js ≥ 20.9
- Docker Desktop (za lokalni Supabase)
- Supabase CLI (`brew install supabase/tap/supabase`)

```bash
# 1. Instaliraj zavisnosti
npm install

# 2. Pokreni lokalni Supabase (Docker)
supabase start
# ^ pri prvom pokretanju skida sve image-e, traje par minuta

# 3. Migracije se automatski primjene. Generiši TS tipove iz baze:
supabase gen types typescript --local > src/types/database.ts

# 4. Kreiraj admin korisnika (samo prvi put)
curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: <SERVICE_ROLE_KEY_IZ_supabase_status>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"peranovicuna6@gmail.com","password":"<jaka-lozinka>","email_confirm":true}'

# 5. Popuni .env.local (vidi .env.example) sa credentials iz `supabase status`

# 6. Pokreni dev server
npm run dev
```

Otvori http://localhost:3000

Admin panel: http://localhost:3000/admin/login

---

## Skripte

| Skripta | Opis |
|---|---|
| `npm run dev` | Next.js dev (Turbopack) na portu 3000 |
| `npm run build` | Produkciona kompilacija |
| `npm run start` | Startuje produkcioni build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pokreće Vitest unit testove (50 testova) |
| `npm run test:watch` | Vitest u watch modu |
| `npm run test:e2e` | Playwright e2e testovi (zahtijeva pokrenut dev server) |
| `npm run lint` | ESLint |

---

## Struktura projekta

```
up-beauty/
├─ supabase/
│  ├─ migrations/              # SQL migracije (init, rls, seed, storage)
│  └─ config.toml
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # root layout, fonts, CookieBanner
│  │  ├─ page.tsx              # /
│  │  ├─ usluge/page.tsx
│  │  ├─ cjenovnik/page.tsx
│  │  ├─ galerija/page.tsx
│  │  ├─ o-meni/page.tsx
│  │  ├─ kontakt/page.tsx
│  │  ├─ obuka/                # upit za obuku (page + server action)
│  │  ├─ zakazi/               # 3-step booking flow + server action + uspjesno
│  │  ├─ politika-privatnosti/
│  │  ├─ uslovi-koriscenja/
│  │  ├─ api/availability/     # GET availability endpoint
│  │  ├─ admin/
│  │  │  ├─ page.tsx           # redirect → /admin/dashboard
│  │  │  ├─ login/
│  │  │  └─ (protected)/       # route group iza auth guard-a
│  │  │     ├─ layout.tsx
│  │  │     ├─ dashboard/
│  │  │     ├─ termini/
│  │  │     ├─ usluge/
│  │  │     ├─ galerija/
│  │  │     └─ postavke/
│  │  ├─ sitemap.ts
│  │  ├─ robots.ts
│  │  └─ opengraph-image.tsx
│  ├─ components/
│  │  ├─ public/               # Nav, Footer, Hero, Services, Gallery, Testimonials, CookieBanner
│  │  ├─ booking/              # BookingFlow, StepServices, StepCalendar, StepDetails, Progress
│  │  ├─ admin/                # AdminShell, Sidebar, BottomNav, dashboard/termini/usluge/galerija/postavke UI
│  │  └─ ui/                   # Button (deljeni primitivi)
│  ├─ lib/
│  │  ├─ supabase/             # client (browser), server (RSC), admin (service role)
│  │  ├─ booking/              # availability engine (pure), schemas (Zod), rules
│  │  ├─ images/               # sharp compress → WebP 1600px
│  │  ├─ utils/                # wa, phone, format, cn
│  │  └─ constants/            # BUSINESS, BOOKING_RULES, theme tokens
│  ├─ types/                   # database.ts (generisano), booking.ts
│  └─ proxy.ts                 # Next 16 middleware (auth guard + session refresh)
└─ tests/
   ├─ unit/                    # vitest — wa, phone, format, availability, smoke
   └─ e2e/                     # playwright — booking flow, admin login
```

---

## Environment varijable

Vidi `.env.example` za pun spisak. Za lokalni razvoj `.env.local` treba da sadrži:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # iz `supabase status`
SUPABASE_SERVICE_ROLE_KEY=...           # iz `supabase status`
RESEND_API_KEY=                         # popuniti prije Phase 8 testova
RESEND_FROM_EMAIL=rezervacije@upmakeup.ba
ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Na produkciji (Vercel), iste varijable postaviti kroz Vercel dashboard.

---

## Supabase šema

Šest tabela:
- `services` — katalog usluga (ime, cijena, trajanje, kategorija, bookable, active)
- `appointments` — termini (status: ceka → potvrdjen → zavrsen/otkazan)
- `blocked_dates` — blokirani rasponi (godišnji, praznici)
- `working_hours` — radno vrijeme po danu u sedmici
- `gallery_images` — slike iz storage bucket-a
- `training_inquiries` — upiti sa `/obuka` forme

RLS je uključen na svim tabelama — javni SELECT gdje treba, javni INSERT za `appointments` i `training_inquiries`, puni pristup za `authenticated` ulogu (admin).

---

## Booking availability engine

Core logika je u `src/lib/booking/availability.ts` — pure funkcija `computeAvailableSlots()` koja računa slotove na osnovu:
1. Radnog vremena (iz `BOOKING_RULES` konstanti — override preko `working_hours` tabele)
2. Blokiranih datuma (tabela `blocked_dates`)
3. Postojećih termina (ceka ili potvrdjen)
4. `min_hours_before` (24h — klijent ne može zakazati unutar 24h)
5. `advance_booking_days` (90 — max 3 mjeseca unaprijed)

Pokriveno sa 14 unit testova (`tests/unit/availability.test.ts`) koji pokrivaju weekday/weekend, različite dužine usluga, blokirane datume, preklapanja, vremenske granice.

---

## Admin panel

**URL:** `/admin/login`

Una se loguje email/lozinka kombinacijom. Session se osvježava preko Next.js proxy-ja (ex-middleware), `src/proxy.ts`. Svi `/admin/*` zahtjevi prolaze kroz guard koji redirect-uje neautentifikovane korisnike.

**Sekcije:**
- **Dashboard** — 4 stat kartice (danas, sedmica, mjesec, prihod) + lista termina za danas
- **Termini** — filteri po rangu i statusu, akcije: WhatsApp pre-fill, Potvrdi, Otkaži, Završen
- **Usluge** — CRUD (kreiranje, izmjena, aktivacija, redoslijed) sa inline modalom
- **Galerija** — upload slika sa automatskom kompresijom (sharp → WebP 1600px), brisanje, kategorizacija
- **Postavke** — radno vrijeme po danu, blokirani datumi, promjena lozinke

---

## Booking flow

**URL:** `/zakazi`

Tri koraka u single-page SPA flow-u:
1. **Usluga** — grid kartica po kategoriji, preskače `bookable=false` (obuka)
2. **Termin** — mjesečni kalendar + fetch `/api/availability?date=...&service_id=...`
3. **Podaci** — RHF + Zod forma, server action insert sa race guard-om (dupla rezervacija)

Nakon uspješnog insert-a → redirect na `/zakazi/uspjesno?id=...` sa WhatsApp deep linkom (pre-fill poruka).

---

## Obuka

**URL:** `/obuka`

Posebna stranica za obuku za šminkanje (800 KM, 5 dana). Nije u booking flow-u — ima vlastitu formu za upit koja piše u `training_inquiries` tabelu.

---

## WhatsApp integracija

Samo `wa.me` deep linkovi — bez zvanične Business API integracije. `src/lib/utils/wa.ts` sadrži `waLink(phone, message)` helper koji normalizuje BA telefon format i URL-enkodira poruku.

Admin panel koristi ovaj helper na "Pošalji WhatsApp potvrdu" dugmetu — otvara pre-fill poruku u novom tabu.

---

## Email (Phase 8 — u toku)

Resend integracija je pripremljena ali čeka API ključ. Postoje `TODO(Phase 8)` komentari u:
- `src/app/zakazi/actions.ts` — novi termin → email Uni
- `src/app/admin/(protected)/termini/actions.ts` — potvrda → email klijentu (ako ima email)
- `src/app/obuka/actions.ts` — novi upit za obuku → email Uni

Kad Resend bude podešen, treba kreirati `src/lib/email/` modul i odkomentarisati pozive.

---

## Deployment (Vercel)

1. Kreiraj produkcioni Supabase projekat na https://supabase.com (region: `eu-central-1`)
2. Primjeni sve migracije: `supabase link --project-ref <ref>` pa `supabase db push`
3. Kreiraj produkciju admin user-a kroz Supabase Auth dashboard
4. Push repo na GitHub
5. Import u Vercel, postavi sve env varijable (sa produkcijskim Supabase URL-om)
6. Deploy → verifikuj smoke test (homepage, booking flow, admin login)
7. Podesi custom domen i dodaj ga u Supabase Auth → URL Configuration

---

## Licenca i autorstvo

Izrada: **NextPixel**
© 2026 UP Makeup
