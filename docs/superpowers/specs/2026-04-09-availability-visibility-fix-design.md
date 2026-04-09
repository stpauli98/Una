# Availability visibility fix — Design

**Date:** 2026-04-09
**Status:** Approved
**Bug report (user):** "Kad klijent rezerviše termin, taj termin postaje nevidljiv tako da kad dođe novi klijent ne može ga rezervisati."

## Problem

`/api/availability` route koristi anonimni Supabase klijent (`createClient()` iz `@/lib/supabase/server`). RLS politike za tabelu `appointments` dozvoljavaju javnosti samo INSERT (za booking formu), ne i SELECT. Posljedica: ruta nikad ne dobije postojeće termine iz baze i funkcija `computeAvailableSlots` prima `existing: []`. Kalendar zato prikazuje sve slotove kao slobodne, uključujući one koje je drugi klijent već rezervisao.

Trenutno ponašanje za korisnika:

1. Klijent A rezerviše utorak 17:00
2. Klijent B otvara `/zakazi`, bira utorak — vidi 17:00 kao slobodan
3. Popuni cijelu formu (ime, telefon, email, napomena)
4. Klikne "Potvrdi rezervaciju"
5. Server action `createAppointment` race guard (koristi admin klijent) uhvati konflikt i vraća grešku "Ovaj termin je upravo zauzet"
6. Klijent B se vrati i mora sve ispočetka

Potvrđeno direktno u lokalnoj bazi:

```
# anon SELECT na appointments
$ curl http://127.0.0.1:54321/rest/v1/appointments -H "apikey: <anon>"
[]

# direktan SQL
$ psql → SELECT count(*) FROM appointments;
 4
```

Race guard u server action-u trenutno nosi cijeli teret zaštite od duplih booking-ova. Funkcionalno je ispravno (dupli upis u bazu se ne desi), ali UX je pokvaren jer klijent B uzalud popunjava formu.

## Decision — Privacy model

Odabran je **strikt privatnost**: server izračuna slobodne slotove i vraća samo njihovu listu. Browser nikad ne dobija sirove podatke o zauzetim terminima (ime, telefon, čak ni "ovaj slot je zauzet, slobodan je u 17:00"). Frontend dobija identičan payload oblik kao i sada: `{ slots: [{start, end}, ...] }`.

## Decision — Approach

Razmatrane tri opcije:

1. **Server ruta koristi service role klijent.** Jedan import change, privatnost sačuvana, race guard ostaje kao safety net.
2. **SQL RPC funkcija `get_available_slots` sa `SECURITY DEFINER`.** Duplicira logiku koja već postoji u TypeScript-u (`computeAvailableSlots`) i u SQL-u — veliki rizik od drift-a kada se `BOOKING_RULES` mijenja samo na jednoj strani.
3. **`public_appointments` view koji expose-uje `(start_time, end_time)` i dozvoljava anon SELECT.** Curi više nego što je striktno potrebno — neulogovani korisnik može da scrape-uje cijelu istoriju booking-ova.

**Izabrana: Opcija 1.** Obrazloženje:

- Najmanji diff, najmanji rizik regresije.
- Prati postojeći pattern — `createAppointment` server action već koristi `createAdminClient()`.
- Anon role ostaje bez pristupa sirovim termin podacima (RLS netaknut).
- Unit testovi (`computeAvailableSlots`) ostaju autoritativni; SQL dupliranje nije potrebno.
- Service role key ostaje strogo server-side (`admin.ts` ima `import "server-only"`).

## Changes

### `src/app/api/availability/route.ts`

1. Promijeniti import:
   ```ts
   // Prije
   import { createClient } from "@/lib/supabase/server";

   // Poslije
   import { createAdminClient } from "@/lib/supabase/admin";
   ```

2. Promijeniti poziv:
   ```ts
   // Prije
   const sb = await createClient();

   // Poslije
   const sb = createAdminClient();
   ```
   (`createAdminClient` je sinhron, nema `await`.)

3. Dodati cache barrier na početak fajla:
   ```ts
   export const dynamic = "force-dynamic";
   export const revalidate = 0;
   ```
   Sprečava da Next.js prikaže zastarjelu listu slotova. Ruta ionako mora uvijek da čita svježe podatke iz baze — keširanje nema smisla.

4. Ostatak koda (upiti, poziv `computeAvailableSlots`, oblik response-a) **ostaje identičan**. Ovo je kritično: frontend ne mijenjamo, response shape ne mijenjamo, testovi ne mijenjamo.

### Ostale rute — razmatra se, ne mijenja se

- **`createAppointment` server action** (`src/app/zakazi/actions.ts`): već koristi `createAdminClient`. Bez izmjene.
- **Admin rute** (`/admin/termini/*`): koriste `createClient` iz `server.ts`, ali admin je ulogovan i RLS dozvoljava sve za `authenticated` role. Bez izmjene.
- **`/admin/dashboard`**: isto, autentikovan. Bez izmjene.
- **`/zakazi/uspjesno`**: koristi `createAdminClient()` za fetch jednog termina po ID. Bez izmjene.
- **`/galerija`, `/usluge`, `/cjenovnik`**: javni read na `services` i `gallery_images` radi jer RLS dozvoljava SELECT za te tabele. Bez izmjene.

## Defense in depth

Fix na `/api/availability` sam za sebe rješava problem za 99%+ stvarnih slučajeva. Sljedeća dva sloja ostaju kao zaštita od edge cases:

1. **Aplikacijski race guard** u `createAppointment` (već postoji, linije 57–76 u `zakazi/actions.ts`). Pokriva scenariji kad dva klijenta kliknu isti slot u istom milisekundu — prije nego što iko od njih osvježi stranicu. Ne diramo.
2. **DB constraint `EXCLUDE USING gist`** — razmatrano i odbačeno. Traži `btree_gist` extension, komplikuje error handling, a postojeći aplikacijski race guard je dovoljan dok ne dokažemo suprotno u produkciji. YAGNI.

## Testing strategy

### Unit tests — bez izmjene

`tests/unit/availability.test.ts` već pokriva slučajeve kad `existing` array sadrži termine. 14 testova na `computeAvailableSlots` ostaje autoritativno za samu logiku. Bug nije bio u logici — bug je bio što API route nije dostavljao podatke u logiku.

### New E2E test — `tests/e2e/booking-conflict.spec.ts`

Pokriva tačno scenario iz bug reporta. Koristi Supabase admin REST preko `fetch` da seed-uje termin prije testa (Playwright ne može direktno da priča sa Supabase JS klijentom u testu, ali može da `fetch`-uje REST API sa service role kljukom iz `process.env`).

Plan testa:

1. Seed: `POST http://localhost:54321/rest/v1/appointments` sa service role ključem. Payload: `service_id=1` (Šminkanje 60 min), `client_name='E2E Conflict Test'`, `client_phone='+38765999888'`, `start_time=<prvi sljedeći utorak 17:00>`, `end_time=<+60min>`, `status='ceka'`.
2. Zapamti vraćeni ID.
3. `page.goto('/zakazi?service=1')`. Očekuj Step 2 (kalendar).
4. `page.getByRole('button', { name: String(dayNumber), exact: true }).click()`.
5. `await page.getByText('Slobodni termini').waitFor()`.
6. Pročitaj sve vidljive slot dugmeta, mapiraj na HH:mm:
   ```ts
   const slots = await page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).allTextContents();
   ```
7. **Assert negative:** `expect(slots).not.toContain('17:00')` — glavni fix regression guard.
8. **Assert positive:** `expect(slots).toContain('18:00')` — osigurava da drugi slotovi i dalje postoje (isključujemo samo 17:00, ne sve).
9. Cleanup u `test.afterEach`: `DELETE` pozivom na REST API koristeći zapamćeni ID.

Test se pokreće sa `E2E_SUPABASE_SERVICE_ROLE_KEY` env varijablom (istom kao `SUPABASE_SERVICE_ROLE_KEY` u `.env.local`, ali čita se eksplicitno kroz env da bi i CI mogao da ga koristi bez `.env.local`). Ako env nije postavljen → `test.skip()`.

Dodatno zapazi: E2E koristi `http://127.0.0.1:54321` (localhost) za REST, pošto se testovi pokreću na istoj mašini gdje je Supabase Docker stack. Playwright već koristi `http://localhost:3000` kao baseURL za Next.

### Live verification

Nakon što unit + e2e svi prolaze, manuelna verifikacija kroz preview browser:

1. Login u admin panel.
2. Kreiraj termin preko `createAppointment` flow-a ili direktno u DB (za poznati datum).
3. Open incognito tab / logout → `/zakazi?service=1` → izaberi isti datum.
4. Observe: 17:00 slot odsutan. Ostali slotovi prisutni.
5. Briši test podatke.

### Regression — ostali testovi

- `npm run typecheck` — mora biti čist.
- `npm test` — svih 73 unit testova mora proći.
- `npm run test:e2e` — svi postojeći (4) + novi booking-conflict test = 5 e2e mora proći.
- `npm run build` — production build mora proći (opcionalno, ali preporučeno jer Next.js build validira sve rute).

## Acceptance criteria

1. Novi `booking-conflict.spec.ts` fails na pre-fix kodu (17:00 slot bi bio u listi) i passes na post-fix kodu.
2. Sva 4 postojeća e2e testa ostaju zelena.
3. Svih 73 unit testova ostaju zelena.
4. Tipovi čisti.
5. Manuelna verifikacija: klijent B, gledajući kalendar na datumu gdje je klijent A već rezervisao 17:00, ne vidi 17:00 kao klikabilni slot.
6. Direktan `curl` na `/api/availability?date=...&service_id=1` sa seed terminom u bazi vraća odgovor u kojem nema 17:00 slota.

## Out of scope

- Realtime ažuriranje kalendara preko Supabase Realtime subscribe (klijent B je otvorio kalendar, klijent A rezerviše, klijentov kalendar se ne osvježava automatski). Ovo nije u originalnom spec-u i dodaje kompleksnost. Klijent B će vidjeti grešku kroz race guard ako klikne. Razmotriti kasnije ako postane čest problem.
- DB exclusion constraint — razmotreno, YAGNI (vidi Defense in depth).
- Dinamička `working_hours` override (trenutno se čitaju konstante iz `BOOKING_RULES`, tabela `working_hours` u bazi se ne konsumira). Postoji od Phase 1 ali se ne koristi u `computeAvailableSlots`. Ovo je poseban, nepovezan nedostatak — ne dirati ovdje.
