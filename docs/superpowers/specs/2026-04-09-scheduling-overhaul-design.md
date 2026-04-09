# Scheduling Overhaul — Design

**Date:** 2026-04-09
**Status:** Approved
**Priority:** Kritično — trenutni sistem gubi termine svaki dan.
**Scope:** Grid + working hours + time blocks + manual admin booking.

## Context

Korisnik je prijavio da sistem gubi termine zbog rigidne logike generisanja slotova. Brainstorming je otkrio tri šira problema koja treba rješavati zajedno (razbijena u faze):

1. **Grid je fiksiran na trajanje usluge** → kratki slobodni prozori (npr. 30 min poslije Trepavica 30min završetka) ne postoje u kalendaru → izgubljeni termini.
2. **`working_hours` tabela u bazi se ignoriše** → admin može u UI-u da isključi dan ali backend i dalje prihvata rezervacije za taj dan → double-booking kad Una ne radi.
3. **Nema manuelnog booking-a iz admin panela + nema fine-grained blokada vremena** → Una mora sama da pazi na telefonske rezervacije i kratke lične obaveze → stress + moguće izgubljene rezervacije.

Istraživanje (3 research subagenta, ~40 web poziva) pokriva Cal.com (open source), Acuity Scheduling, Square Appointments, Fresha, Calendly, Treatwell i Microsoft Bookings. Ključni nalazi su konsolidovani u odluke ispod.

## Research summary — Šta industrija radi

**Grid strategija (Cal.com, Acuity GCD mode, Treatwell):**
Univerzalni pattern je `slotInterval` (grid korak) **nezavisan** od `eventLength` (trajanja usluge):

```
cursor = working_start
while cursor + eventLength <= working_end:
    if no_conflict([cursor, cursor + eventLength]):
        emit slot(cursor)
    cursor += slotInterval   # NIJE eventLength
```

Acuity u automatskom modu računa `slotInterval = GCD(all_service_durations)`. Treatwell hardkoduje 15 min. Cal.com dozvoljava admin-u da postavi per-event. **Za Una use case (sve usluge ≥ 30 min), fiksni 30 min je optimalno** — matches GCD, odgovara industrijskom defaultu za beauty salone.

**Working hours model (Cal.com):**
Jedna `availability` tabela sa `days_of_week int[]`, `date date NULL` za override. Naša postojeća `working_hours` tabela sa `day_of_week int` je manje elegantna ali funkcionalno ekvivalentna za recurring weekly pattern. Bez potrebe za refactoring-om.

**Time blocks (Square "Personal events", Fresha "Blocked time"):**
Square ima `block_time` boolean flag na personal events (ON = blokira public booking). Fresha ima first-class `blocked_time` entitet sa frequency, title, emoji. Oba se pohranjuju u istoj tabeli ili u posebnoj — funkcionalno isto. **Za naš case biramo posebnu tabelu `time_blocks`** radi čistoće (bez NULL kolona u `appointments`).

**Manual admin booking (Acuity, Square, Calendly):**
Svi sistemi dozvoljavaju adminu da kreira termin koji krši pravila (izvan radnog vremena, double-book, unutar min_hours_before) sa **soft warning-om, ne hard block-om**. Status odmah `confirmed`. Notifikacija opciona.

**Timezone (Cal.com "Lock to business timezone"):**
Za in-person usluge preporuka je **lock-to-studio**: klijent uvijek vidi vremena u studio TZ (Europe/Sarajevo). DST se rješava automatski kroz IANA tz bazu u Postgres-u. **Ovo NIJE u scope-u ovog spec-a** — postojeći kod već u praksi radi jer su testovi pokazali korektno ponašanje u lokalnoj TZ. Pravi fix za dijasporu dolazi kao poseban spec ako se pojavi problem.

## Decisions

### D1. Grid je fiksni 30 min

**Odluka:** `computeAvailableSlots` koristi konstantu `SLOT_INTERVAL_MIN = 30` kao loop step, a `durationMin` samo za overlap window check.

**Zašto ne GCD?** Acuity radi GCD mode, ali u našem slučaju sve postojeće usluge su multiples of 30 (30 nije — ali najmanja je 60 min Šminkanje, a spec za 30-min uslugu još ne postoji osim kao "šta ako Una doda"). Fiksnih 30 min je:
- Predvidljivo (Una uvijek zna da su slotovi na :00 i :30)
- Usklađeno sa industrijom (Treatwell 15, Cal.com default 30, Fresha)
- Ne zahtijeva dinamičko računanje pri svakom zahtjevu

**Zašto ne 15 min?** Ako Una doda 15-min uslugu u budućnosti, mijenjamo konstantu. Tada je to poseban migration koji zahtijeva update testova. Dok ne postoji takva usluga, 30 min je sweet spot između granularnosti i jednostavnosti.

**Primjer ponašanja za Una case:**

Postoji: Šminkanje 60min u 17:00 (zauzima 17:00–18:00).

| Klijent B bira | Grid slotovi | Vraćeni slotovi (nakon overlap check) |
|---|---|---|
| Šminkanje 60min | 17:00, 17:30, 18:00, 18:30, 19:00, 19:30, 20:00 | 18:00, 18:30, 19:00, 19:30, 20:00 |
| Spa pedikir 60min | 17:00, 17:30, 18:00, ..., 20:00 | 18:00, 18:30, 19:00, 19:30, 20:00 |
| Pedikir 120min | 17:00, 17:30, 18:00, 18:30, 19:00 | 18:00, 18:30, 19:00 |
| Trepavice 180min | 17:00, 17:30, 18:00 | 18:00 |

**Što rješava:** Tvoj scenario (Trepavice 30min završena u 17:30 → sljedeći slobodan slot za Šminkanje 60min je 17:30 ili 18:00, a ne samo "nema slobodnog termina"). Cross-service blokada i dalje radi — overlap check je nepromijenjen.

### D2. Working hours se čita iz baze sa fallback-om

**Odluka:** `computeAvailableSlots` prima `hoursByWeekday: Map<number, DailyHours>` kao ulaz umjesto da interno poziva `getHoursForDay()` iz `BOOKING_RULES`. Route handler (`/api/availability`) je odgovoran da pročita `working_hours` tabelu i napravi taj map prije poziva.

**Fallback strategija:** Ako baza ne odgovara ili red za dan nedostaje, koristi `BOOKING_RULES` kao fallback. Ovo osigurava da se sistem ne "rasklopi" ako admin slučajno izbriše red iz `working_hours` tabele.

**Why pure function signature change:** `computeAvailableSlots` ostaje pure (bez DB accessa). Svi testovi ostaju jednostavni (prosljeđuju mock `hoursByWeekday`). Realnu DB integraciju testiramo kroz e2e.

**Shape:**

```ts
type DailyHoursMap = Record<number, DailyHours>; // 0=Sun..6=Sat

computeAvailableSlots(input: {
  date: Date;
  durationMin: number;
  now: Date;
  existing: ExistingAppointment[];
  blocked: BlockedRange[];
  blockedTimes: ExistingAppointment[];  // NEW — iz time_blocks tabele
  hoursByWeekday: DailyHoursMap;         // NEW — iz working_hours tabele
}): Slot[]
```

### D3. Time blocks imaju posebnu tabelu `time_blocks`

**Odluka:** Nova tabela sa shape-om blizak `appointments`, ali samo sa vremenskim kolonama (bez klijenta, telefona, usluge):

```sql
CREATE TABLE time_blocks (
  id bigint primary key generated always as identity,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_blocks_valid_range CHECK (end_time > start_time)
);

CREATE INDEX idx_time_blocks_start_time ON time_blocks(start_time);
```

**Zašto posebna tabela, a ne `kind` diskriminator u `appointments`:**

Research agent je preporučio unified tabelu. **Ne slažem se:** polovina kolona u `appointments` bi bile NULL za blokade (`service_id`, `client_name`, `client_phone`, `client_email`, `notes`, `status`). NULL-heavy kolone komplikuju zahtjeve (RLS policies, type safety, inserts, migracije). Posebna tabela je čistije.

**Kompatibilnost sa postojećim `blocked_dates`:** `blocked_dates` ostaje za multi-day blokade (odmori, praznici). `time_blocks` je za sub-day ili ukupno kratke intervale (recimo 2-4 sata). Oba se čitaju i koriste u overlap check-u.

**RLS:** Public read (zato što frontend treba da vidi blokade radi prikaza), authenticated write (samo admin kreira).

### D4. Manual admin booking — nova forma u `/admin/termini`

**Odluka:** Dugme "Dodaj termin" na `/admin/termini` stranici koje otvara modal sa formom:
- Izbor usluge (dropdown iz `services` tabele)
- Ime klijenta (required)
- Telefon (required, ista validacija kao public forma)
- Email (opciono)
- Datum + vrijeme (2 polja, default: sutra 17:00)
- Napomena (opciono)
- Status (default: `potvrdjen`)
- Checkbox: "Pošalji WhatsApp potvrdu klijentu" (default: ON)

Server action kreira termin preko `createAdminClient()` (zaobilazi RLS, ali i race guard ga ne blokira ako admin svjesno želi double-book). Ako postoji konflikt, **prikazuje warning** u UI-u prije insert-a: "Ovaj termin se preklapa sa: [drugi termin]. Želite li svejedno?" — sa dugmetom "Da, ubaci svakako" i "Ne, odustajem".

**Status nakon manual insert-a:** `potvrdjen` (ne `ceka`), jer je Una već verbalno potvrdila na telefonu.

**Dugme za WhatsApp nakon insert-a:** Koristi postojeći `buildAppointmentWaMessage` helper. Admin može kliknuti i poslati potvrdu.

### D5. Manual "Blokiraj vrijeme" forma

**Odluka:** Dugme "Blokiraj vrijeme" na `/admin/postavke` stranici (ili zasebna sekcija na `/admin/termini`) koje otvara modal:
- Datum
- Vrijeme od
- Vrijeme do
- Razlog (opciono, npr. "zubar", "pauza za ručak", "privatno")

Server action ubacuje u `time_blocks` tabelu. Prikazuje postojeće blokove ispod forme sa dugmetom "Ukloni".

**Recurring blokovi (npr. "svakog ponedjeljka 12:00–13:00 ručak"):** NIJE u scope-u ovog spec-a. Fresha preporučuje da se lunch break-ovi rješavaju kroz split shift u `working_hours` tabeli. Una može u `working_hours` da postavi 09:00–12:00 i 13:00–21:00 kao dva reda — što trenutna shema ne podržava (jedan red po danu). **Future enhancement.** Za sada, Una ručno blokira ručak kao non-recurring, ili koristi blocked_dates za "ne radim uopšte".

### D6. Co-dependencies u implementaciji

Tri promjene su povezane jer sve utiču na `computeAvailableSlots` signaturu:

- D1 (grid): dodaje konstantu `SLOT_INTERVAL_MIN`, mijenja loop step
- D2 (working_hours): dodaje `hoursByWeekday` parameter
- D3 (time_blocks): dodaje `blockedTimes` parameter

**Moraju se uraditi u istoj PR / deploy liniji** jer se potpis funkcije mijenja. Dijelimo implementaciju u faze unutar istog plana ali **svaka faza ostavlja sistem u zelenom stanju** (testovi + typecheck + build prolaze).

**Redoslijed faza:**

1. **Phase 1 — Grid 30 min**: Core promjena u `computeAvailableSlots`, update unit testova (14 postojećih), update e2e testova (cross-service). Ostalo (working_hours, time_blocks) ostaje hardkodovano ili prazno.
2. **Phase 2 — `working_hours` iz baze**: Route handler čita working_hours, passes `hoursByWeekday` map-u. Fallback na `BOOKING_RULES`.
3. **Phase 3 — `time_blocks` tabela + integracija**: Migracija, RLS, route handler čita blokove, prosljeđuje u `computeAvailableSlots`.
4. **Phase 4 — Admin UI**: "Dodaj termin" forma + "Blokiraj vrijeme" forma + server actions.

Svaka faza ima vlastiti commit.

## Changes

### Phase 1: Grid 30 min

**Files:**
- `src/lib/booking/availability.ts` — dodati konstantu, promijeniti loop step
- `tests/unit/availability.test.ts` — ažurirati očekivanja za sve 14 testova (sada će biti više slotova)
- `tests/e2e/booking-conflict.spec.ts` — provjeri da i dalje radi
- `tests/e2e/booking-cross-service.spec.ts` — slotovi se mijenjaju, pogledati assertions

**Grid konstanta:**

```ts
// src/lib/booking/availability.ts
export const SLOT_INTERVAL_MIN = 30;
```

**Loop izmjena:**

```ts
// Prije
cursor = addMinutes(cursor, durationMin);

// Poslije
cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
```

Ostatak funkcije ostaje identičan. Overlap check, blocked dates, min_hours_before, advance_booking_days — sve radi jer ne zavisi od grid koraka.

**Očekivane promjene u testovima:**

| Test | Stari expected | Novi expected |
|---|---|---|
| Šminkanje 60min, weekday, prazno | `[17:00, 18:00, 19:00, 20:00]` | `[17:00, 17:30, 18:00, 18:30, 19:00, 19:30, 20:00]` |
| Pedikir 120min, weekday, prazno | `[17:00, 19:00]` | `[17:00, 17:30, 18:00, 18:30, 19:00]` |
| Trepavice 180min, weekday, prazno | `[17:00]` | `[17:00, 17:30, 18:00]` |
| Saturday 60min, prazno | 16 slotova (05:00-20:00) | 32 slota (05:00, 05:30, ..., 20:00) |

**Test za tvoj scenario (novi):**

Dodaj unit test koji verifikuje:

```
Given: 30-min termin zauzima 17:00-17:30
When: klijent bira 60-min uslugu za isti dan (weekday)
Then: slotovi su [17:30, 18:00, 18:30, 19:00, 19:30, 20:00]
```

### Phase 2: `working_hours` iz baze

**Files:**
- `src/lib/booking/rules.ts` — dodati `getHoursForDayFromRows()` helper
- `src/app/api/availability/route.ts` — čita working_hours tabelu, konstruiše `hoursByWeekday` map
- `src/lib/booking/availability.ts` — prima `hoursByWeekday` kao opcioni parametar (backward-compatible), fallback na `BOOKING_RULES`
- `tests/unit/availability.test.ts` — dodati testove za working_hours override
- `tests/e2e/working-hours.spec.ts` — NOVI, provjerava da admin toggle zaista utiče na public availability

**Signatura nakon Phase 2:**

```ts
export function computeAvailableSlots(input: {
  date: Date;
  durationMin: number;
  now: Date;
  existing: ExistingAppointment[];
  blocked: BlockedRange[];
  hoursByWeekday?: DailyHoursMap; // optional, fallback na BOOKING_RULES
}): Slot[]
```

**Helper funkcija:**

```ts
// src/lib/booking/rules.ts
export type DailyHoursMap = Record<number, DailyHours>;

export function hoursMapFromRows(
  rows: Array<{ day_of_week: number; open_time: string; close_time: string; is_open: boolean }>,
): DailyHoursMap {
  const map: DailyHoursMap = {};
  for (const row of rows) {
    map[row.day_of_week] = {
      open: row.open_time.slice(0, 5), // "17:00:00" → "17:00"
      close: row.close_time.slice(0, 5),
      isOpen: row.is_open,
    };
  }
  return map;
}
```

**Fallback u `computeAvailableSlots`:**

```ts
const hours = input.hoursByWeekday?.[target.getDay()] ?? getHoursForDay(target.getDay());
```

### Phase 3: `time_blocks` tabela + integracija

**Files:**
- `supabase/migrations/20260409_add_time_blocks.sql` — nova tabela + RLS
- `src/types/database.ts` — regenerated
- `src/lib/booking/availability.ts` — prima `blockedTimes` parameter
- `src/app/api/availability/route.ts` — čita time_blocks za dati dan
- `tests/unit/availability.test.ts` — testovi za time_blocks handling
- `tests/e2e/time-blocks.spec.ts` — NOVI e2e

**Migracija:**

```sql
CREATE TABLE public.time_blocks (
  id bigint primary key generated always as identity,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_blocks_valid_range CHECK (end_time > start_time)
);

CREATE INDEX idx_time_blocks_start_time ON public.time_blocks(start_time);
CREATE INDEX idx_time_blocks_active_range
  ON public.time_blocks (start_time, end_time);

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_blocks: public read"
  ON public.time_blocks
  FOR SELECT
  USING (true);

CREATE POLICY "time_blocks: authenticated full access"
  ON public.time_blocks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Signatura nakon Phase 3:**

```ts
computeAvailableSlots(input: {
  date: Date;
  durationMin: number;
  now: Date;
  existing: ExistingAppointment[];
  blocked: BlockedRange[];
  blockedTimes?: ExistingAppointment[]; // optional, iz time_blocks
  hoursByWeekday?: DailyHoursMap;
}): Slot[]
```

**Overlap check:** `time_blocks` se tretiraju **identično** kao `existing` termini. Oba se mergeuju u jedan `allExisting` array prije overlap check-a.

### Phase 4: Admin UI

**Files:**
- `src/app/admin/(protected)/termini/actions.ts` — dodati `createManualAppointment()` server action
- `src/components/admin/ManualAppointmentForm.tsx` — NOVI, modal forma
- `src/app/admin/(protected)/termini/page.tsx` — dodati "Dodaj termin" dugme
- `src/app/admin/(protected)/postavke/actions.ts` — dodati `createTimeBlock()`, `deleteTimeBlock()`
- `src/components/admin/TimeBlocksManager.tsx` — NOVI, sekcija na postavke stranici
- `src/app/admin/(protected)/postavke/page.tsx` — dodati TimeBlocksManager

**`createManualAppointment` semantika:**
- Validira formu preko proširene Zod scheme (sličan kao public, ali bez `consent` polja i sa `status` default `potvrdjen`)
- Provjeri konflikt (race guard), ali **ne blokira** — vraća `{ ok: false, conflict: true, conflictWith: [...] }` ako ima preklapanja
- Frontend prikazuje warning i dozvoljava admin-u da klikne "Svejedno ubaci" što triggeruje drugi poziv sa `force: true`
- Na `force: true`, insert prolazi bez provjere

**`createTimeBlock` semantika:**
- Validira `start_time < end_time`
- Validira da je `start_time` najmanje sutra (ne dozvoljava blokade u prošlosti)
- Insert u `time_blocks` tabelu

### Phase 0 (pre-work): Spec commit

Pošto je ovo veliki spec sa 4 faze, commit-ujemo spec odmah prije nego što krenemo sa Phase 1. Plan dokument se commit-uje prije prvog implementacijskog commit-a.

## Testing strategy

### Unit tests

**Phase 1:** Updejtovati 14 postojećih testova za novi grid. Dodati 1 novi test za scenario "30-min termin u 17:00 → 60-min usluga vidi 17:30".

**Phase 2:** 3 nova testa:
- `hoursByWeekday` override radi (isključen dan → prazan array)
- Kratko radno vrijeme (npr. 09:00–11:00) → manji broj slotova
- Null hoursByWeekday → koristi BOOKING_RULES fallback

**Phase 3:** 4 nova testa:
- Time block koji se poklapa sa slot-om → slot isključen
- Time block koji se djelimično preklapa → slot isključen
- Više time blokova istog dana → svi isključeni
- Time block + postojeći termin + blocked date istovremeno → kompozicija svega

### E2E tests

**Phase 1:** Update `booking-conflict.spec.ts` i `booking-cross-service.spec.ts` za nova očekivanja. Eksplicitno test za 30-min grid ponašanje.

**Phase 2:** Novi `working-hours.spec.ts`:
- Admin se loguje, isključi ponedjeljak u `/admin/postavke`
- Kao neulogovan, otvori `/zakazi?service=1`, pokušaj da izabereš ponedjeljak → disabled ili nema slotova
- Ponovi za "ponedjeljak otvoreno 18:00–20:00" → samo 2 slota (18:00, 19:00 za 60min uslugu)

**Phase 3:** Novi `time-blocks.spec.ts`:
- Seed direktan insert u `time_blocks` tabelu za utorak 18:00–19:00
- Klijent otvara kalendar, bira utorak
- 18:00 slot odsutan, 17:00, 17:30, 19:00, 19:30, 20:00 prisutni

**Phase 4:** Novi `admin-manual-booking.spec.ts`:
- Admin login
- Klik "Dodaj termin" → popuni formu → submit
- Provjeri da je termin u `/admin/termini` listi
- Provjeri da isti slot više nije dostupan na public kalendaru

Plus `admin-time-block.spec.ts`:
- Admin login
- Kreira time block preko forme u postavkama
- Provjeri da se prikazuje u listi blokova
- Provjeri da je slot koji overlaipuje sa tim blokom skriven na public kalendaru
- Ukloni block → slot se vraća

### Regression

Svi postojeći testovi moraju ostati zeleni nakon svake faze:
- 73 unit
- 7 e2e

Finalno: 73 + ~12 novih unit = ~85 unit; 7 + 4 nova e2e = 11 e2e.

## Acceptance criteria

1. **Phase 1:** Klijent koji bira bilo koju uslugu vidi slotove na 30-min grid-u. Tvoj originalni scenario (30-min termin u 17:00 → sljedeći slobodan slot u 17:30) radi.
2. **Phase 2:** Una u `/admin/postavke` isključi ponedjeljak → sljedeći ponedjeljak se ne pojavljuje kao klikabilan u public kalendaru. Skrati četvrtak na 18:00–20:00 → samo odgovarajući slotovi prisutni.
3. **Phase 3:** Una kreira time block 18:00–19:00 u srijedu → public kalendar ne prikazuje 18:00 niti 18:30 kao slobodan za 60-min uslugu.
4. **Phase 4:** Una iz `/admin/termini` klikne "Dodaj termin", ukuca podatke, ubaci termin → taj termin se pojavljuje u listi, javi kalendar ga blokira.
5. Svi unit + e2e testovi prolaze.
6. Typecheck čist, build prolazi.
7. Ne pada ni jedan postojeći test.

## Out of scope

- **Timezone fix za dijasporu (Europe/Sarajevo lock)** — posebni spec kad se pojavi problem. Trenutno radi u lokalnoj TZ.
- **Recurring time blocks** (npr. svakog ponedjeljka 12–13 ručak) — posebna kompleksnost (RRULE), YAGNI.
- **Split shifts u working_hours** (npr. pon 09–12 i 14–18) — zahtijeva schema migration, YAGNI.
- **Per-service buffer time** (npr. 10 min cleanup poslije svakog termina) — korisno ali nije kritično, poseban spec ako zatreba.
- **iCal / ICS export** — poseban feature, nije vezan za ovaj bug.
- **DB exclusion constraint** (`EXCLUDE USING gist`) — razmatrano ranije, YAGNI dok ne dokažemo da app-level race guard nije dovoljan.
- **Dugo-term timezone safety za rezervacije > 1 godina unaprijed** — advance_booking_days je 90, nije realno.
- **Admin notifikacija kada klijent rezerviše** — već postoji kao TODO(Phase 8) za Resend, nije vezano za ovaj spec.

## Risk assessment

**Rizik 1: Update svih postojećih testova** — Phase 1 mijenja očekivane brojeve slotova u 14+ testova. Risk je visok za "missed one" propuštanja. **Mitigacija:** Running `npm test` odmah nakon svake izmjene, ne nakon cijele faze.

**Rizik 2: Breaking signatura `computeAvailableSlots`** — Phase 2 i 3 mijenjaju potpis funkcije. Risk je da neki caller (npr. buduć admin view kalendara) ne prosljeđuje nove parametre. **Mitigacija:** Backward-compatible opcioni parametri sa fallback-om.

**Rizik 3: RLS policy na `time_blocks` public read** — Treba da bude read-only jer frontend mora da zna blokade. Ali ako su blokade "privatne" (npr. "zubar"), Una možda ne želi da se curi razlog. **Mitigacija:** RLS dozvoljava SELECT samo `start_time, end_time` kolona (ne `reason`). **Ispravka:** RLS ne može per-kolona u Postgres-u. Alternativa: View `public_time_blocks` koji expose-uje samo vremena. **Za sada:** Svi redovi public read (uključujući reason), jer se razlozi inače ne pokazuju u UI javne strane. Reason je samo u admin panelu.

**Rizik 4: Admin manual booking sa `force: true` pravi double-booking** — to je namjerno, ali Una može nehotice da klikne. **Mitigacija:** Modal warning sa eksplicitnim "Svejedno ubaci" dugmetom i tekstom "Napomena: Ovo će kreirati preklapajuće termine."

**Rizik 5: Race conditions između manual i online bookinga** — Ako admin dodaje termin u istom trenutku kad online klijent pokušava isti slot, oba mogu da prođu. **Mitigacija:** Postojeći app-level race guard radi za oba flow-a jer oboje pozivaju isti `createAppointment` server action logic. Manual flow ima bypass samo kad `force: true`.

## Migration notes for existing data

`appointments` i `blocked_dates` se ne diraju. `working_hours` već ima seed podatke iz Phase 1 (7 redova). `time_blocks` je nova tabela, inicijalno prazna. Nema potrebe za data migration.
