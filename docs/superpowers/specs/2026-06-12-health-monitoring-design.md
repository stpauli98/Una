# UP Beauty Health Monitoring — dizajn

**Datum:** 2026-06-12
**Status:** odobren dizajn, čeka implementacioni plan
**Motivacija:** Dva produkcijska buga (validate-slot weekday/sekunde `bc05504→53a2f55`, anon INSERT vs RLS RETURNING `bf82018`) oborila su javne rezervacije i danima ostala neprimijećena. Sistem mora automatski otkrivati ovakva odstupanja.

## Cilj

Automatski, periodični nadzor cijelog sistema (kod, produkcijska baza, javni sajt, podaci) koji poredi stvarno stanje sa eksplicitno definisanim standardima i šalje email kad nešto odstupa.

## Ne-ciljevi (namjerno van opsega)

- **Ništa ne piše u produkcijsku bazu.** Sve provjere su read-only; proba upisa koristi FK-violation trik koji ne može upisati red.
- **Ništa ne stiže Uni** — ni email, ni push, ni vidljiva rezervacija. Nema canary rezervacija.
- **Ne dira Vercel env** (nema CLI auth) — buduće proširenje.
- Nije APM/uptime servis — granularnost je 2× dnevno + ručno pokretanje, ne minutna.

## Arhitektura

```
scripts/health/
  run.mjs              # runner: pokreće slojeve, skuplja rezultate, šalje email
  checks/
    code.mjs           # Sloj 1 — standardi koda (lokalno)
    prod-drift.mjs     # Sloj 2 — prod baza vs standardi (Management API)
    signals.mjs        # Sloj 3 — signali ishoda (javni REST + sajt)
  expected/
    policies.json      # očekivani RLS policy-ji po tabeli
    constraints.json   # očekivani constrainti/trigeri na appointments
  lib/
    mgmt-api.mjs       # Supabase Management API klijent (User-Agent, token)
    report.mjs         # formatiranje izvještaja (terminal + email HTML)
    email.mjs          # Resend slanje (samo WARN/FAIL)
  last-run.json        # zadnji izvještaj (gitignoran)
```

- Čisti Node ESM skriptovi, bez novih runtime dependency-ja (koristi se postojeći `resend` paket i `fetch`).
- Svaka provjera vraća `{ id, layer, status: "PASS"|"WARN"|"FAIL", detail, expected?, actual? }`.
- `FAIL` = polomljena funkcionalnost ili narušen standard; `WARN` = sumnjivo/za pregled; greška u samoj provjeri (mreža pala i sl.) = `FAIL` sa `detail: "provjera nije mogla da se izvrši"` — tišina nikad ne smije značiti "nije ni provjereno".

### npm skripte

```
npm run health           # svi slojevi
npm run health:code      # samo sloj 1
npm run health:prod      # samo sloj 2
npm run health:signals   # samo sloj 3
```

### Kredencijali — `.env.health` (gitignoran)

Nezavisan od `.env.local` (koju e2e swap mijenja — naučena lekcija):

```
SUPABASE_ACCESS_TOKEN=...     # Management API (read-only upiti)
SUPABASE_PROJECT_REF=ljxggwpzljtjeeljtqts
RESEND_API_KEY=...            # za alert email (dobaviti od korisnika / Vercel)
HEALTH_ALERT_EMAIL=nmil322@icloud.com
SITE_URL=https://www.upmakeup.ba
```

## Sloj 1 — standardi koda (lokalno, bez mreže)

1. `tsc --noEmit` prolazi.
2. Unit testovi prolaze (`vitest run`).
3. **Grep pravila** (lista u `checks/code.mjs`, svako pravilo = regex + objašnjenje + izuzeci):
   - `R1` Zabranjen `.insert(` + `.select(` lanac na fajlovima koji koriste `createPublicClient` (anon RLS nema SELECT → 42501). Lekcija: `bf82018`.
   - `R2` Zabranjen date-fns token `"e"` u `formatInTimeZone`/`format` pozivima (pogrešna day-of-week konvencija). Lekcija: `53a2f55`.
   - `R3` Goli `getDay()`/`new Date()` bez `toZonedTime`/`fromZonedTime` u `src/lib/booking/` i `src/app/zakazi/` (van `tz.ts`/`day-bounds.ts`).
   - `R4` Server akcija koja zove `.update(`/`.delete(`/`.insert(` u `src/app/admin/` mora u istom fajlu imati `updateTag(` ili `revalidatePath(`.
   - `R5` `console.error` u server kodu mora ići kroz `sanitizeError` (PII u Vercel logovima).
   - Pravila se dodaju kad naučimo novu lekciju — svaki novi prod bug dobija svoje pravilo.

## Sloj 2 — prod drift (Management API, read-only)

1. **RLS policy-ji** na `appointments`, `services`, `time_blocks`, `working_hours`, `settings`, `gallery_images`, `push_subscriptions`, `blocked_dates`, `training_inquiries` == snapshot u `expected/policies.json` (poredi se ime, cmd, role, USING, WITH CHECK).
2. **Constrainti + trigeri** na `appointments` == `expected/constraints.json` (pkey, FK, status CHECK, `chk_time_range`, `no_overlapping_appointments`, `trg_appointments_updated_at`).
3. **Migracije:** `supabase_migrations.schema_migrations` na produkciji == lista fajlova u `supabase/migrations/` — odstupanje u BILO KOM smjeru je FAIL (lokalna migracija koja nije pushovana = tačno scenario RLS buga).
4. **RLS uključen** (`relrowsecurity`) na svim javnim tabelama.
5. **Radno vrijeme sanity:** 7 redova, `open_time < close_time` gdje je `is_open`.
6. **Settings sanity:** ključevi ⊆ {min_hours_before, advance_booking_days, cancellation_hours, break_between_min}, vrijednosti parsabilne.

## Sloj 3 — signali ishoda (javni REST + sajt, read-only)

1. **FK-proba upisa:** POST `/rest/v1/appointments` sa anon ključem i `service_id=999999` (ne postoji). Očekivano: greška `23503` (foreign key) = cijeli put (gateway → anon ključ → RLS INSERT policy → constraint) zdrav. `42501` = RLS polomljen → FAIL. Bilo šta drugo → FAIL sa detaljima. *Anon ključ se dobavlja sa Management API `/api-keys` u hodu — nikad hardkodiran.*
2. **Availability:** `GET /api/availability?date=<sutra..+7>&service_id=<prva bookable>` vraća 200 i validan `{slots:[{start,end}]}`; nijedan dan sa slotovima u 7 dana → WARN (može biti legitimno popunjeno, ali za pregled).
3. **ISR sadržaj:** `/cjenovnik` sadrži "KM"; `/usluge` ima bar 5 usluga; `/` i `/zakazi` vraćaju 200.
4. **Starost zadnje javne rezervacije:** `max(created_at) where confirmation_token is not null` > 14 dana → WARN (prag u configu).
5. **Integritet podataka:** nema preklapanja aktivnih termina (`ceka`/`potvrdjen`); nema termina van radnog vremena tog dana; nema `ceka` starijih od 3 dana (Una zaboravila potvrditi) → WARN.
6. **Slot konzistencija (lekcija današnjeg buga #1):** za sutra, svaki slot koji `/api/availability` ponudi mora proći istu logiku validacije (`isSlotWithinWorkingHours` + `sarajevoDayOfWeek` nad prod working_hours) — generisanje i validacija ne smiju se razilaziti.

## Automatika (launchd)

- `~/Library/LaunchAgents/com.nextpixel.upbeauty-health.plist`: pokreće `npm run health` u 09:00 i 18:00; `StartCalendarInterval` ×2. Ako Mac spava u to vrijeme, launchd pokrene po buđenju.
- Skripta za (de)instalaciju: `scripts/health/install-launchd.sh` / `uninstall-launchd.sh`.
- stdout/stderr u `~/Library/Logs/upbeauty-health.log`.

## Email obavještenja

- Šalje se **samo ako ima WARN ili FAIL** (sve PASS = tišina, samo `last-run.json`).
- Resend, FROM postojeći verifikovani domen, TO `HEALTH_ALERT_EMAIL`.
- Subject: `[UP Health] N FAIL, M WARN — <datum vrijeme>`.
- Tijelo: tabela po provjeri — šta se očekivalo, šta je nađeno, koji sloj; na dnu link na repo i komanda za ručni rerun.
- Ako Resend pošalje grešku: ispis u log + macOS notifikacija (`osascript`) kao fallback.

## Testiranje sistema

- Unit testovi za čiste funkcije (parsiranje policy snapshot poređenja, grep pravila nad fixture stringovima, report formatiranje) u `tests/unit/health/`.
- Slojevi 2 i 3 protiv **lokalnog Docker Supabase** (isti API oblik): namjerno polomi policy lokalno → provjera mora prijaviti FAIL.
- Ručna verifikacija protiv produkcije prije uključivanja launchd-a.

## Otvorena pitanja / preduslovi

- `RESEND_API_KEY` — nije dostupan lokalno (izgubljen `.env.local.prod`); dobaviti iz Vercel dashboarda ili od korisnika prije email koraka. Do tada: izvještaj u terminal + macOS notifikacija.

## Buduća proširenja (van ovog plana)

- Vercel env provjera (`\n` u varijablama) kad bude CLI auth.
- GitHub Actions kao sekundarni motor (nezavisan od Maca).
- Slanje sedmičnog "sve OK" digest-a radi povjerenja u sistem.
