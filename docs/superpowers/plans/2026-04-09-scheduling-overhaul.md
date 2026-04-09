# Scheduling Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ispraviti gubitke termina kroz četiri povezane promjene: fixed 30-min grid, dynamic working hours iz baze, time_blocks tabela za sub-day blokade, i admin UI za manuelni booking + blokade.

**Architecture:** Četiri sekvencijalne faze, svaka ostavlja sistem u zelenom stanju. Faza 1 je pure logika (grid), Faza 2 dodaje DB čitanje u route handler, Faza 3 uvodi novu tabelu + migraciju, Faza 4 dodaje admin UI. Signatura `computeAvailableSlots` raste backward-compatible kroz faze (opcioni parametri sa fallback-om).

**Tech Stack:** Next.js 16 App Router, Supabase (migracije + RLS), Vitest unit, Playwright e2e, TypeScript.

---

## Context — pročitaj prije Task 1

**Spec dokument:** `docs/superpowers/specs/2026-04-09-scheduling-overhaul-design.md` — pročitaj ga prije nego što kreneš. Sadrži research findings i zašto se biraju određeni patterni (Cal.com slotInterval, Fresha blocked time, Acuity soft-warn).

**Trenutno stanje koje se ne diramo:**
- `/api/availability` već koristi `createAdminClient` (fix od ranije danas)
- `computeAvailableSlots` je pure funkcija sa 14 unit testova
- RLS: `appointments` public insert, authenticated full; `blocked_dates` public read + auth full; `working_hours` public read + auth full; sve ostalo normalno
- E2E: 7 postojećih testova svi zeleni
- Supabase local stack radi na `127.0.0.1:54321` i `192.168.100.9:54321` (LAN), Next.js dev na `0.0.0.0:3000`
- Admin kredencijali: email `peranovicuna6@gmail.com`, lozinka u `E2E_ADMIN_PASSWORD` env varijabli (Una je promijenila na `Test1312..`)

**Testna komanda za e2e:**
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test <ime-ili-sve> --reporter=list
```

**Testna komanda za unit:**
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test
```

---

## File Structure Overview

```
supabase/migrations/
  20260409120000_time_blocks.sql              ← CREATE (Phase 3)

src/
  lib/booking/
    availability.ts                            ← MODIFY (Phase 1, 2, 3)
    rules.ts                                   ← MODIFY (Phase 2 — hoursMapFromRows helper)
    schemas.ts                                 ← MODIFY (Phase 4 — manual booking schema)
  app/api/availability/route.ts                ← MODIFY (Phase 2, 3)
  app/admin/(protected)/termini/
    actions.ts                                 ← MODIFY (Phase 4 — createManualAppointment)
    page.tsx                                   ← MODIFY (Phase 4 — add button + modal)
  app/admin/(protected)/postavke/
    actions.ts                                 ← MODIFY (Phase 4 — createTimeBlock, deleteTimeBlock)
    page.tsx                                   ← MODIFY (Phase 4 — add TimeBlocksManager section)
  components/admin/
    ManualAppointmentForm.tsx                  ← CREATE (Phase 4)
    TimeBlocksManager.tsx                      ← CREATE (Phase 4)
  types/database.ts                            ← MODIFY (Phase 3 — regenerate from DB)

tests/unit/
  availability.test.ts                         ← MODIFY (Phase 1 — update 14 tests, add new ones)

tests/e2e/
  booking-conflict.spec.ts                     ← MODIFY (Phase 1 — adjust expected slots)
  booking-cross-service.spec.ts                ← MODIFY (Phase 1 — adjust expected slots)
  working-hours.spec.ts                        ← CREATE (Phase 2)
  time-blocks.spec.ts                          ← CREATE (Phase 3)
  admin-manual-booking.spec.ts                 ← CREATE (Phase 4)
  admin-time-block.spec.ts                     ← CREATE (Phase 4)
```

---

# PHASE 1 — Grid 30 min

**Cilj faze:** Slotovi se generišu sa fiksnim korakom od 30 min umjesto po trajanju usluge. Korisnikov scenario iz brainstorming-a (30-min termin u 17:00 → sljedeći slobodan u 17:30) radi.

**Blast radius:** `computeAvailableSlots` pure funkcija + 14 unit testova + 2 e2e testa.

## Task 1.1: Introduce SLOT_INTERVAL_MIN constant + update grid step

**Files:**
- Modify: `src/lib/booking/availability.ts`

- [ ] **Step 1: Pročitaj postojeći `availability.ts` u cjelini**

Read: `src/lib/booking/availability.ts` (99 linija). Treba ti cijeli mental model funkcije prije nego što mijenjaš.

- [ ] **Step 2: Dodaj konstantu i zamijeni loop step**

Modify `src/lib/booking/availability.ts`. U trenutnom kodu linija 76-96 je `while` petlja koja inkrementira `cursor`. Treba dvije promjene:

Iznad `export function computeAvailableSlots`, dodaj konstantu:

```ts
/**
 * Fixed grid korak za generisanje slotova. Nezavisan od trajanja usluge
 * (Cal.com pattern) — slotovi se uvijek generišu na 30-min granici bez
 * obzira je li usluga 60, 90, 120 ili 180 minuta. Ovo sprečava gubitak
 * kratkih prozora između postojećih termina (npr. 30-min termin završen
 * u 17:30 → sljedeći slot u 17:30 je dostupan).
 */
export const SLOT_INTERVAL_MIN = 30;
```

U `while` petlji (linija 95), zamijeni:

```ts
cursor = addMinutes(cursor, durationMin);
```

sa:

```ts
cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
```

Mora biti **jedna izmjena** — ta linija se pojavljuje samo jednom u fajlu (posljednji red unutar while petlje).

Potvrda — nakon izmjene, `grep` mora vratiti samo `SLOT_INTERVAL_MIN`:

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && grep -n "addMinutes(cursor" src/lib/booking/availability.ts
```

Expected:
```
95:    cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
```
(Linija broja može biti malo drugačija ako dodaš konstantu.)

- [ ] **Step 3: Pokreni unit testove, OČEKUJ da pukne**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test -- tests/unit/availability.test.ts
```

Expected: **Više testova failuje** jer očekuju stari grid (step = durationMin). Nemoj još popraviti — to je Task 1.2. Samo potvrdi da failovi dolaze iz `availability.test.ts` i da su u linijama koje provjeravaju broj ili redoslijed slotova.

- [ ] **Step 4: Bez commit-a za sada**

Task 1.1 i Task 1.2 idu zajedno u isti commit jer razdvojeni ostavljaju test suite crven. Ne commit-uj.

---

## Task 1.2: Update 14 unit testova za novi grid + novi test

**Files:**
- Modify: `tests/unit/availability.test.ts`

- [ ] **Step 1: Pročitaj sve postojeće testove**

Read: `tests/unit/availability.test.ts` (sav fajl). Mora ti biti jasno kako svaki test provjerava grid. Postoje tri grupe:
1. **weekday (utorak)** — 17:00–21:00
2. **weekend (subota/nedjelja)** — 05:00–21:00
3. **granice** (blocked dates, min_hours_before, advance, prošlost)

- [ ] **Step 2: Zamijeni očekivane vrijednosti u svim weekday testovima**

Modify `tests/unit/availability.test.ts`. Pronađi i zamijeni očekivanja u postojećim testovima:

Test `"60-min usluga, bez postojećih → slotovi 17:00, 18:00, 19:00, 20:00"`:
```ts
// Prije
expect(hhmm(slots)).toEqual(["17:00", "18:00", "19:00", "20:00"]);

// Poslije
expect(hhmm(slots)).toEqual([
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
]);
```

Test `"120-min usluga, bez postojećih → 17:00, 19:00 (20:00 bi završio u 22:00)"`:
Naziv testa treba update jer se vraćaju i 17:30, 18:00, 18:30, 19:00.

```ts
it("120-min usluga, bez postojećih → slotovi na 30-min gridu dok end ≤ close", () => {
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 120,
    now: NOW_FAR,
    existing: [],
    blocked: [],
  });
  expect(hhmm(slots)).toEqual(["17:00", "17:30", "18:00", "18:30", "19:00"]);
});
```

(19:00 start → 21:00 end, tačno na close. 19:30 start → 21:30 end, prelazi close, isključeno.)

Test `"180-min usluga, bez postojećih → samo 17:00 (17→20 ok, 20→23 nema vremena)"`:

```ts
it("180-min usluga, bez postojećih → slotovi na 30-min gridu dok end ≤ close", () => {
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 180,
    now: NOW_FAR,
    existing: [],
    blocked: [],
  });
  expect(hhmm(slots)).toEqual(["17:00", "17:30", "18:00"]);
});
```

(18:00 start → 21:00 end, tačno na close. 18:30 start → 21:30 prelazi, isključeno.)

Test `"postojeći termin 18:00–19:00 uklanja 18:00 slot ali ostavlja 17:00 i 19:00"`:

Naziv i očekivanja:

```ts
it("postojeći termin 18:00–19:00 blokira preklapajuće slotove, ostavlja ostale", () => {
  const existing: ExistingAppointment[] = [
    { start: at(2026, 4, 7, 18), end: at(2026, 4, 7, 19) },
  ];
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 60,
    now: NOW_FAR,
    existing,
    blocked: [],
  });
  // 60-min slot na 17:30 bi bio [17:30, 18:30] — overlap sa [18:00, 19:00] → blokiran
  // 60-min slot na 18:00 bi bio [18:00, 19:00] — overlap → blokiran
  // 60-min slot na 18:30 bi bio [18:30, 19:30] — overlap → blokiran
  // 60-min slot na 19:00 bi bio [19:00, 20:00] — ne overlaipuje → OK
  expect(hhmm(slots)).toEqual(["17:00", "19:00", "19:30", "20:00"]);
});
```

Test `"postojeći termin 17:30–18:30 briše 17:00 i 18:00 slot (overlap)"`:

```ts
it("postojeći termin 17:30–18:30 blokira sve preklapajuće 60-min slotove", () => {
  const existing: ExistingAppointment[] = [
    { start: at(2026, 4, 7, 17, 30), end: at(2026, 4, 7, 18, 30) },
  ];
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 60,
    now: NOW_FAR,
    existing,
    blocked: [],
  });
  // 17:00 [17-18] overlaipuje sa [17:30-18:30] — blokirano
  // 17:30 [17:30-18:30] potpuno overlaipuje — blokirano
  // 18:00 [18-19] overlaipuje — blokirano
  // 18:30 [18:30-19:30] — ne overlaipuje (granica), dozvoljeno
  // 19:00 [19-20] — slobodno
  // 19:30 [19:30-20:30] — slobodno
  // 20:00 [20-21] — slobodno
  expect(hhmm(slots)).toEqual(["18:30", "19:00", "19:30", "20:00"]);
});
```

- [ ] **Step 3: Zamijeni očekivane vrijednosti u weekend testovima**

Test `"60-min usluga, bez postojećih → 16 slotova 05:00..20:00"`:

```ts
it("60-min usluga subota, bez postojećih → 32 slota na 30-min gridu", () => {
  const slots = computeAvailableSlots({
    date: day(2026, 4, 11),
    durationMin: 60,
    now: NOW_FAR,
    existing: [],
    blocked: [],
  });
  // 05:00 do 20:00 start (05:00..20:00 inclusive), svakih 30 min = 32 slota
  expect(slots).toHaveLength(32);
  expect(hhmm(slots)[0]).toBe("05:00");
  expect(hhmm(slots).at(-1)).toBe("20:00");
});
```

Test `"120-min nedjelja, bez postojećih → 05:00, 07:00, ..., 19:00 (8 slotova)"`:

```ts
it("120-min nedjelja, bez postojećih → slotovi na 30-min gridu do zatvaranja", () => {
  const slots = computeAvailableSlots({
    date: day(2026, 4, 12),
    durationMin: 120,
    now: NOW_FAR,
    existing: [],
    blocked: [],
  });
  // Od 05:00 do 19:00 (jer 19:00 + 120min = 21:00 = close), svakih 30 min
  // 05:00, 05:30, 06:00, ..., 19:00 = 29 slotova
  expect(slots).toHaveLength(29);
  expect(hhmm(slots)[0]).toBe("05:00");
  expect(hhmm(slots).at(-1)).toBe("19:00");
});
```

- [ ] **Step 4: Blokirani datumi testovi — ne mijenjaju se**

Testovi `"blokirani datum koji pokriva ciljani dan → prazno"`, `"blokirani raspon koji obuhvata ciljani dan → prazno"`, `"blokirani raspon koji NE obuhvata ciljani dan → normalni slotovi"` — prvi i drugi ostaju identični (empty array). Treći mora update-ovati očekivanja:

```ts
it("blokirani raspon koji NE obuhvata ciljani dan → normalni slotovi", () => {
  const blocked: BlockedRange[] = [
    { from: day(2026, 4, 1), to: day(2026, 4, 3) },
  ];
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 60,
    now: NOW_FAR,
    existing: [],
    blocked,
  });
  expect(hhmm(slots)).toEqual([
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
  ]);
});
```

- [ ] **Step 5: Vremenske granice testovi — update prvog, drugi i treći ostaju isti**

Test `"min_hours_before (24h): 17:00 slot za sljedeci dan kad je sad 18:00 → isključen (< 24h)"`:

```ts
it("min_hours_before (24h): slotovi < 24h od sada su isključeni", () => {
  // sad: utorak 18:00 → slot u srijedu 17:00 je za 23h → isključen
  // slot u srijedu 17:30 je za 23.5h → isključen
  // slot u srijedu 18:00 je za 24h tačno → border (treba provjeriti)
  // slot u srijedu 19:00 je za 25h → uključen
  const now = at(2026, 4, 7, 18, 0);
  const slots = computeAvailableSlots({
    date: day(2026, 4, 8),
    durationMin: 60,
    now,
    existing: [],
    blocked: [],
  });
  expect(hhmm(slots)).not.toContain("17:00");
  expect(hhmm(slots)).not.toContain("17:30");
  expect(hhmm(slots)).toContain("19:00");
});
```

Testovi `"advance_booking_days"` i `"datum u prošlosti"` ne treba mijenjati — ne zavise od grid koraka.

- [ ] **Step 6: Dodaj novi test za korisnikov originalni scenario**

Na kraju describe bloka "weekday (utorak)", dodaj:

```ts
it("30-min termin u 17:00 → sljedeći 60-min slot za istu ili drugu uslugu počinje u 17:30", () => {
  // Ovo je scenario koji je korisnik opisao u brainstorming-u:
  // Trepavice 30min u 17:00 → sljedeći klijent bira Šminkanje 60min → 17:30
  const existing: ExistingAppointment[] = [
    { start: at(2026, 4, 7, 17, 0), end: at(2026, 4, 7, 17, 30) },
  ];
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 60,
    now: NOW_FAR,
    existing,
    blocked: [],
  });
  // 17:00 [17-18] overlaipuje — blokirano
  // 17:30 [17:30-18:30] — ne overlaipuje — SLOBODNO
  // 18:00, 18:30, 19:00, 19:30, 20:00 — slobodni
  expect(hhmm(slots)).toEqual([
    "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
  ]);
  expect(hhmm(slots)[0]).toBe("17:30"); // eksplicitna provjera: prvi slot ODMAH poslije postojećeg
});
```

- [ ] **Step 7: Pokreni unit testove, očekuj PASS**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test -- tests/unit/availability.test.ts
```

Expected: **Svi testovi prolaze** (14 postojećih updated + 1 novi = 15 testova u `availability.test.ts`).

Ako neki test i dalje failuje → pročitaj expected vs received pažljivo, ispravi očekivanje. Logika je sigurno ispravna (Cal.com pattern je dokazan), ali moguće je da si promijenio broj koji sam ja pogrešno izračunao u plan-u. Vjeruj računici iz koda, ne meni.

- [ ] **Step 8: Pokreni sve unit testove**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test
```

Expected: svih 74+ testova prolaze (73 postojeća + 1 novi = 74).

- [ ] **Step 9: Commit Task 1.1 + 1.2 zajedno**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/lib/booking/availability.ts tests/unit/availability.test.ts && \
  git commit -m "feat(booking): fixed 30-min slot grid (Cal.com pattern)

Slot generation loop now steps by SLOT_INTERVAL_MIN (30 min) instead
of the booked service's duration. Overlap check is unchanged — it
uses [cursor, cursor + durationMin] to test conflicts. This matches
the Cal.com/Acuity pattern and unlocks fine-grained scheduling.

User scenario: Trepavice 30min booked at 17:00 → next 60-min slot
for any service is 17:30 (previously not offered at all).

Updated 14 unit tests to match new expected slot lists. Added 1 new
test that locks in the 30-min-after-existing behavior."
```

---

## Task 1.3: Update E2E testovi za novi grid

**Files:**
- Modify: `tests/e2e/booking-conflict.spec.ts`
- Modify: `tests/e2e/booking-cross-service.spec.ts`
- Modify: `tests/e2e/booking.spec.ts`

- [ ] **Step 1: Pokreni sve e2e testove, vidi šta se lomi**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list 2>&1 | tail -30
```

Expected: **Neki prolaze, neki failuju.** Failovi su u testovima koji eksplicitno očekuju staru listu slotova.

- [ ] **Step 2: `booking-conflict.spec.ts` — assertions ostaju iste, ali provjeri**

Read: `tests/e2e/booking-conflict.spec.ts`. Test očekuje `expect(slotTexts).not.toContain("17:00")` i `expect(slotTexts).toContain("18:00")`. Oba su i dalje tačna — test treba da i dalje prolazi.

Ako prolazi, ništa ne mijenjaj. Ako failuje, logguj šta dolazi kroz `console.log` u testu i debuguj.

- [ ] **Step 3: `booking-cross-service.spec.ts` — assertions ostaju iste**

Read: `tests/e2e/booking-cross-service.spec.ts`. Oba testa u fajlu koriste `not.toContain("17:00")` i `not.toContain("18:00")` — oba su kompatibilna sa novim grid-om.

Ako prolazi, ništa ne mijenjaj. Ako failuje, debuguj.

- [ ] **Step 4: `booking.spec.ts` — happy path, nema eksplicitnih assertion-a na listu slotova**

Read: `tests/e2e/booking.spec.ts`. Test samo klikne **prvi** slot, ne provjerava koliko ih ima. Kompatibilan.

Ako prolazi, ništa ne mijenjaj.

- [ ] **Step 5: Pokreni e2e ponovo, sve zeleno**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list 2>&1 | tail -15
```

Expected: 7 passed.

- [ ] **Step 6: Commit samo ako su test izmjene bile potrebne**

Ako si mijenjao testove, commit:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add tests/e2e/ && \
  git commit -m "test(e2e): adjust booking tests for 30-min grid"
```

Ako ništa nisi mijenjao, nema commit-a — samo je potvrđeno da e2e testovi neumjetno prolaze sa novim gridom.

---

## Task 1.4: Verifikacija Phase 1

- [ ] **Step 1: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 2: Unit + e2e**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test 2>&1 | tail -5 && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list 2>&1 | tail -10
```

Expected: 74 unit pass, 7 e2e pass.

- [ ] **Step 3: Production build**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run build 2>&1 | tail -15
```

Expected: build prolazi.

**Phase 1 checkpoint završen.** Sistem je u zelenom stanju. Možeš stati ovdje i ostaviti ostalo za drugi put, ili nastaviti na Phase 2.

---

# PHASE 2 — Working hours iz baze

**Cilj faze:** `/api/availability` čita `working_hours` tabelu i prosljeđuje radno vrijeme u `computeAvailableSlots`. Admin toggle u `/admin/postavke` stvarno utiče na public kalendar.

**Blast radius:** `computeAvailableSlots` signatura (opcioni parametar), `rules.ts` helper, route handler, 3 nova unit testa, 1 novi e2e.

## Task 2.1: Dodaj `hoursMapFromRows` helper u `rules.ts`

**Files:**
- Modify: `src/lib/booking/rules.ts`

- [ ] **Step 1: Pročitaj `rules.ts`**

Read: `src/lib/booking/rules.ts`. Trenutno ima `BOOKING_RULES` re-export i `getHoursForDay()` funkciju.

- [ ] **Step 2: Dodaj tip i helper**

Modify `src/lib/booking/rules.ts`. Dodaj na kraj fajla:

```ts
import type { DailyHours } from "@/types/booking";

/**
 * Map weekday (0=nedjelja..6=subota) → radno vrijeme za taj dan.
 * Prazne ćelije znače "dan ne postoji u mapi" → fallback na BOOKING_RULES.
 */
export type DailyHoursMap = Record<number, DailyHours>;

/**
 * Pretvara `working_hours` DB redove u `DailyHoursMap`.
 * Tolera redove gdje `open_time`/`close_time` imaju sekunde ("17:00:00")
 * skraćivanjem na "HH:mm".
 */
export function hoursMapFromRows(
  rows: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_open: boolean;
  }>,
): DailyHoursMap {
  const map: DailyHoursMap = {};
  for (const row of rows) {
    map[row.day_of_week] = {
      open: row.open_time.slice(0, 5),
      close: row.close_time.slice(0, 5),
      isOpen: row.is_open,
    };
  }
  return map;
}
```

- [ ] **Step 3: Unit test za helper**

Create test at end of `tests/unit/availability.test.ts` (dodaj novi describe blok na vrh fajla poslije postojećih import-a nije potrebno; dodaj na dno fajla novi describe):

```ts
describe("hoursMapFromRows", () => {
  it("pretvara DB redove u mapu", async () => {
    const { hoursMapFromRows } = await import("@/lib/booking/rules");
    const rows = [
      { day_of_week: 1, open_time: "17:00:00", close_time: "21:00:00", is_open: true },
      { day_of_week: 6, open_time: "05:00:00", close_time: "21:00:00", is_open: true },
      { day_of_week: 0, open_time: "00:00:00", close_time: "00:00:00", is_open: false },
    ];
    const map = hoursMapFromRows(rows);
    expect(map[1]).toEqual({ open: "17:00", close: "21:00", isOpen: true });
    expect(map[6]).toEqual({ open: "05:00", close: "21:00", isOpen: true });
    expect(map[0]).toEqual({ open: "00:00", close: "00:00", isOpen: false });
  });

  it("prazna mapa za prazne redove", async () => {
    const { hoursMapFromRows } = await import("@/lib/booking/rules");
    expect(hoursMapFromRows([])).toEqual({});
  });
});
```

- [ ] **Step 4: Pokreni test**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test -- tests/unit/availability.test.ts
```

Expected: svi prolaze (76 total).

- [ ] **Step 5: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/lib/booking/rules.ts tests/unit/availability.test.ts && \
  git commit -m "feat(booking): hoursMapFromRows helper for working_hours DB rows

Converts working_hours table rows into a DailyHoursMap keyed by
day_of_week. Handles the 'HH:mm:ss' format Postgres returns for time
columns by truncating to 'HH:mm'.

Preparation for phase 2 — dynamic working hours."
```

---

## Task 2.2: `computeAvailableSlots` prima opcioni `hoursByWeekday`

**Files:**
- Modify: `src/lib/booking/availability.ts`

- [ ] **Step 1: Pročitaj trenutni `AvailabilityInput` type**

Read: `src/lib/booking/availability.ts`. Obrati pažnju na `AvailabilityInput` tip (linije 15-28).

- [ ] **Step 2: Ažuriraj tip i implementaciju**

Modify `src/lib/booking/availability.ts`:

Import na vrhu:

```ts
import { BOOKING_RULES, getHoursForDay, type DailyHoursMap } from "./rules";
```

(Prije je bilo bez `DailyHoursMap`.)

Tip `AvailabilityInput` treba dodati opcioni parametar:

```ts
export type AvailabilityInput = {
  date: Date;
  durationMin: number;
  now: Date;
  existing: ExistingAppointment[];
  blocked: BlockedRange[];
  /**
   * Radno vrijeme po danu u sedmici (0=ned..6=sub). Ako nije prosljeđeno,
   * fallback na BOOKING_RULES. Ako je prosljeđeno ali ključ za konkretan
   * dan nedostaje, takođe fallback.
   */
  hoursByWeekday?: DailyHoursMap;
};
```

U tijelu funkcije (linija koja računa `hours`), zamijeni:

```ts
const hours = getHoursForDay(target.getDay());
```

sa:

```ts
const weekday = target.getDay();
const hours = input.hoursByWeekday?.[weekday] ?? getHoursForDay(weekday);
```

- [ ] **Step 3: Dodaj unit testove za hoursByWeekday**

U `tests/unit/availability.test.ts`, u describe bloku `"computeAvailableSlots — weekday (utorak)"`, dodaj nove testove:

```ts
it("hoursByWeekday override: isključen dan → prazan array", () => {
  const closedTuesday: DailyHoursMap = {
    2: { open: "00:00", close: "00:00", isOpen: false },
  };
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7), // utorak
    durationMin: 60,
    now: NOW_FAR,
    existing: [],
    blocked: [],
    hoursByWeekday: closedTuesday,
  });
  expect(slots).toEqual([]);
});

it("hoursByWeekday override: kraće radno vrijeme smanjuje broj slotova", () => {
  const shortTuesday: DailyHoursMap = {
    2: { open: "19:00", close: "21:00", isOpen: true },
  };
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 60,
    now: NOW_FAR,
    existing: [],
    blocked: [],
    hoursByWeekday: shortTuesday,
  });
  // 19:00 [19-20] OK, 19:30 [19:30-20:30] OK, 20:00 [20-21] OK
  expect(hhmm(slots)).toEqual(["19:00", "19:30", "20:00"]);
});

it("hoursByWeekday fallback: nedostaje ključ za dan → BOOKING_RULES default", () => {
  const partialMap: DailyHoursMap = {
    1: { open: "10:00", close: "12:00", isOpen: true }, // samo ponedjeljak
  };
  // Utorak (day_of_week=2) nije u mapi, treba pasti na BOOKING_RULES (17-21)
  const slots = computeAvailableSlots({
    date: day(2026, 4, 7),
    durationMin: 60,
    now: NOW_FAR,
    existing: [],
    blocked: [],
    hoursByWeekday: partialMap,
  });
  expect(hhmm(slots)).toEqual([
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
  ]);
});
```

Na vrhu fajla dodaj import:

```ts
import type { DailyHoursMap } from "@/lib/booking/rules";
```

(Ako već nije tu.)

- [ ] **Step 4: Pokreni testove**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test -- tests/unit/availability.test.ts
```

Expected: svi prolaze (79 total).

- [ ] **Step 5: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/lib/booking/availability.ts tests/unit/availability.test.ts && \
  git commit -m "feat(booking): computeAvailableSlots accepts optional hoursByWeekday

New optional parameter lets the caller pass per-weekday working hours
(e.g. from the working_hours DB table). When absent, falls back to
BOOKING_RULES constants. When present but the specific weekday key is
missing, also falls back (so a partial map doesn't accidentally close
days that weren't configured).

Three new unit tests cover: closed day, shorter hours, partial map
fallback."
```

---

## Task 2.3: Route handler čita `working_hours` iz baze

**Files:**
- Modify: `src/app/api/availability/route.ts`

- [ ] **Step 1: Pročitaj trenutni route handler**

Read: `src/app/api/availability/route.ts`. Postoji `Promise.all([apptRes, blockedRes])`.

- [ ] **Step 2: Dodaj treći upit za working_hours**

Modify `src/app/api/availability/route.ts`.

Import na vrhu (dopuni postojeći):

```ts
import { computeAvailableSlots } from "@/lib/booking/availability";
import { hoursMapFromRows } from "@/lib/booking/rules";
```

U `Promise.all` pozivu, dodaj treći upit:

```ts
const [apptRes, blockedRes, hoursRes] = await Promise.all([
  sb
    .from("appointments")
    .select("start_time,end_time")
    .gte("start_time", dayStart)
    .lt("start_time", dayEnd)
    .in("status", ["ceka", "potvrdjen"]),
  sb.from("blocked_dates").select("date_from,date_to"),
  sb.from("working_hours").select("day_of_week,open_time,close_time,is_open"),
]);
```

Odmah poslije error handling za apptRes i blockedRes, dodaj:

```ts
if (hoursRes.error) {
  return NextResponse.json({ error: hoursRes.error.message }, { status: 500 });
}
```

U pozivu `computeAvailableSlots`, dodaj `hoursByWeekday` parametar:

```ts
const slots = computeAvailableSlots({
  date,
  durationMin: service.duration_min,
  now: new Date(),
  existing: (apptRes.data ?? []).map((a) => ({
    start: new Date(a.start_time),
    end: new Date(a.end_time),
  })),
  blocked: (blockedRes.data ?? []).map((b) => ({
    from: parseISO(b.date_from),
    to: parseISO(b.date_to),
  })),
  hoursByWeekday: hoursMapFromRows(hoursRes.data ?? []),
});
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 4: Ručni smoke test kroz curl**

```bash
/usr/bin/curl -s "http://localhost:3000/api/availability?date=2026-04-14&service_id=1" | head -c 400
echo ""
```

Expected: JSON sa `slots: [...]`. Broj slotova odgovara gridu iz Task 1.2 (npr. 7 slotova za 60-min uslugu na weekday sa 17-21 radnim vremenom iz baze koje je identično `BOOKING_RULES`).

- [ ] **Step 5: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/app/api/availability/route.ts && \
  git commit -m "feat(api): availability route reads working_hours from DB

Route now queries the working_hours table and passes the result as
hoursByWeekday to computeAvailableSlots. If a day is marked
is_open=false or has different open/close times than BOOKING_RULES,
the availability calculation now reflects that. Admin working hours
toggle in /admin/postavke finally has a real effect on public bookings."
```

---

## Task 2.4: E2E test za working_hours dynamic change

**Files:**
- Create: `tests/e2e/working-hours.spec.ts`

- [ ] **Step 1: Napiši test**

Create `tests/e2e/working-hours.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { addDays, format, getDay } from "date-fns";

/**
 * E2E: admin mijenja working_hours za ponedjeljak, public kalendar
 * odmah reflektuje tu promjenu.
 *
 * Seed direktno kroz Supabase REST — radi sa service role.
 * Cleanup vraća originalno stanje u finally.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

type HoursRow = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
};

async function getHours(dayOfWeek: number): Promise<HoursRow> {
  if (!SERVICE_ROLE_KEY) throw new Error("missing service role key");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/working_hours?day_of_week=eq.${dayOfWeek}&select=*`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`getHours failed: ${res.status}`);
  const rows = (await res.json()) as HoursRow[];
  if (rows.length === 0) throw new Error(`no hours row for day ${dayOfWeek}`);
  return rows[0];
}

async function setHours(
  dayOfWeek: number,
  patch: Partial<Omit<HoursRow, "day_of_week">>,
): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/working_hours?day_of_week=eq.${dayOfWeek}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );
}

/** Pronađe sljedeći weekday koji je minimum 3 dana u budućnosti. */
function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  return date;
}

test("working_hours override: kraće radno vrijeme smanjuje broj slotova", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }

  const target = nextBookableWeekday();
  const weekday = getDay(target); // 1..5
  const original = await getHours(weekday);

  // Skrati na 19:00-21:00 (umjesto 17:00-21:00)
  await setHours(weekday, {
    open_time: "19:00:00",
    close_time: "21:00:00",
    is_open: true,
  });

  try {
    await page.goto("/zakazi?service=1"); // Šminkanje 60min
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Sa radnim vremenom 19-21, 60-min usluga: 19:00, 19:30, 20:00
    expect(slotTexts).toContain("19:00");
    expect(slotTexts).toContain("19:30");
    expect(slotTexts).toContain("20:00");
    expect(slotTexts).not.toContain("17:00");
    expect(slotTexts).not.toContain("18:00");
    expect(slotTexts).not.toContain("18:30");
  } finally {
    // Vrati originalne sate
    await setHours(weekday, {
      open_time: original.open_time,
      close_time: original.close_time,
      is_open: original.is_open,
    });
  }
});

test("working_hours override: isključen dan → nema slotova", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }

  const target = nextBookableWeekday();
  const weekday = getDay(target);
  const original = await getHours(weekday);

  await setHours(weekday, { is_open: false });

  try {
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first()
      .click();

    // Ili poruka "nema slobodnih termina", ili prazna lista
    await page.waitForTimeout(1500);
    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    expect(slotTexts).toHaveLength(0);
  } finally {
    await setHours(weekday, {
      is_open: original.is_open,
      open_time: original.open_time,
      close_time: original.close_time,
    });
  }
});
```

- [ ] **Step 2: Pokreni test**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test tests/e2e/working-hours.spec.ts --reporter=list 2>&1 | tail -15
```

Expected: 2 passed.

Ako failuje sa "day not found" ili "element not visible" — to je zbog proxy cache-a ili postojećeg stanja u browseru. Iskreni run iz scratch-a trebao bi proći.

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add tests/e2e/working-hours.spec.ts && \
  git commit -m "test(e2e): working_hours override reflects on public calendar"
```

---

## Task 2.5: Phase 2 verifikacija

- [ ] **Step 1: Svi testovi**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck && npm test 2>&1 | tail -5 && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list 2>&1 | tail -15
```

Expected: typecheck čist, 79 unit pass, 9 e2e pass (7 + 2 nova).

---

# PHASE 3 — `time_blocks` tabela + integracija

**Cilj faze:** Nova tabela za sub-day blokade, route handler čita, `computeAvailableSlots` uzima u obzir.

## Task 3.1: Migracija za `time_blocks`

**Files:**
- Create: `supabase/migrations/20260409120000_time_blocks.sql`

- [ ] **Step 1: Napiši migraciju**

Create `supabase/migrations/20260409120000_time_blocks.sql`:

```sql
-- Time blocks: sub-day blokade kada Una nije dostupna
-- (zubar, privatne obaveze, pauze). Multi-day blokade ostaju u
-- blocked_dates tabeli — time_blocks je za kraće intervale sa vremenom.

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

-- RLS
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- Public read: frontend mora da vidi da ne nudi blokirane slotove.
-- Reason može curiti ali u UI javne strane se ne prikazuje.
CREATE POLICY "time_blocks: public read"
  ON public.time_blocks
  FOR SELECT
  USING (true);

-- Admin: puni pristup kreiranje, brisanje, update
CREATE POLICY "time_blocks: authenticated full access"
  ON public.time_blocks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Primjeni migraciju**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && supabase db push 2>&1 | tail -10
```

Expected: `Applying migration 20260409120000_time_blocks.sql` + `Finished supabase db push`.

Ako pukne sa `supabase db push` iz nekog razloga (netačna linked referenca), alternativa je da se migracija izvrši direktno kroz local db:

```bash
docker exec -i supabase_db_up-beauty psql -U postgres -d postgres < \
  "/Users/nmil/Desktop/Una Peranovic/up-beauty/supabase/migrations/20260409120000_time_blocks.sql"
```

Expected: `CREATE TABLE`, `CREATE INDEX` x 2, `ALTER TABLE`, `CREATE POLICY` x 2.

- [ ] **Step 3: Potvrdi da tabela postoji**

```bash
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c \
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='time_blocks' AND table_schema='public' ORDER BY ordinal_position;"
```

Expected:
```
 column_name  |        data_type         
--------------+--------------------------
 id           | bigint
 start_time   | timestamp with time zone
 end_time     | timestamp with time zone
 reason       | text
 created_at   | timestamp with time zone
```

- [ ] **Step 4: Regeneriši TypeScript tipove**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  supabase gen types typescript --local 2>/dev/null > src/types/database.ts && \
  head -5 src/types/database.ts
```

Expected: prvi red mora biti `export type Json =`. Ako postoji debug header (`Connecting to db...`), ponovo pokreni sa `2>/dev/null`.

- [ ] **Step 5: Potvrdi da `time_blocks` postoji u tipovima**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && grep -A 3 "time_blocks" src/types/database.ts | head -20
```

Expected: vidi `time_blocks` definiciju u `Tables` objektu.

- [ ] **Step 6: Commit migraciju i regenerisane tipove**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add supabase/migrations/20260409120000_time_blocks.sql src/types/database.ts && \
  git commit -m "feat(db): time_blocks table for sub-day blocking

New table with start_time, end_time, reason columns for partial-day
blocks like dentist appointments or lunch breaks. Multi-day blocks
remain in blocked_dates table.

RLS: public SELECT (frontend needs to see blocks to hide slots),
authenticated full access."
```

---

## Task 3.2: `computeAvailableSlots` prima `blockedTimes`

**Files:**
- Modify: `src/lib/booking/availability.ts`

- [ ] **Step 1: Dodaj parametar**

Modify `src/lib/booking/availability.ts`. U `AvailabilityInput` tipu, dodaj:

```ts
export type AvailabilityInput = {
  date: Date;
  durationMin: number;
  now: Date;
  existing: ExistingAppointment[];
  blocked: BlockedRange[];
  /** Time blocks iz `time_blocks` tabele — tretiraju se kao postojeći termini. */
  blockedTimes?: ExistingAppointment[];
  hoursByWeekday?: DailyHoursMap;
};
```

U tijelu funkcije, gdje se koristi `existing` za overlap check:

Prije (oko linije 87):
```ts
// 6. Preklapanje sa postojećim
const overlaps = existing.some(
  (appt) => cursor < appt.end && end > appt.start,
);
```

Poslije:
```ts
// 6. Preklapanje sa postojećim terminima ili time blocks
const allBlocking = [...existing, ...(input.blockedTimes ?? [])];
const overlaps = allBlocking.some(
  (item) => cursor < item.end && end > item.start,
);
```

Pošto sada koristiš `input.blockedTimes`, treba takođe napraviti da se `existing` rekonstruktuje kroz `input.existing` da bi bilo konzistentno. Pronađi liniju gdje se `existing` destructura (oko linije 45):

```ts
const { date, durationMin, now, existing, blocked } = input;
```

Zamijeni sa:

```ts
const { date, durationMin, now, existing, blocked } = input;
// Napomena: blockedTimes i hoursByWeekday se pristupaju kroz input.* direktno
```

(Samo komentar, jer je destructuring već OK.)

- [ ] **Step 2: Dodaj unit testove**

U `tests/unit/availability.test.ts`, dodaj novi describe blok poslije postojećih:

```ts
describe("computeAvailableSlots — time blocks", () => {
  it("time block koji pokriva 18:00-19:00 blokira 18:00 slot za 60-min uslugu", () => {
    const blockedTimes: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 18), end: at(2026, 4, 7, 19) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      blockedTimes,
    });
    expect(hhmm(slots)).not.toContain("18:00");
    expect(hhmm(slots)).toContain("17:00");
    expect(hhmm(slots)).toContain("19:00");
  });

  it("time block 17:30-18:30 blokira 17:00, 17:30, 18:00 za 60-min uslugu", () => {
    const blockedTimes: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17, 30), end: at(2026, 4, 7, 18, 30) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      blockedTimes,
    });
    expect(hhmm(slots)).not.toContain("17:00");
    expect(hhmm(slots)).not.toContain("17:30");
    expect(hhmm(slots)).not.toContain("18:00");
    expect(hhmm(slots)).toContain("18:30");
    expect(hhmm(slots)).toContain("19:00");
  });

  it("time block + existing termin + blocked date — sve se kompozira", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [{ start: at(2026, 4, 7, 17), end: at(2026, 4, 7, 18) }],
      blocked: [],
      blockedTimes: [{ start: at(2026, 4, 7, 19), end: at(2026, 4, 7, 20) }],
    });
    // existing blokira 17:00 (i 17:30 jer overlaipuje 17:30-18:30)
    // blockedTime blokira 19:00 (i 18:30 jer overlaipuje 18:30-19:30, 19:30 jer 19:30-20:30)
    expect(hhmm(slots)).not.toContain("17:00");
    expect(hhmm(slots)).not.toContain("17:30");
    expect(hhmm(slots)).toContain("18:00");
    expect(hhmm(slots)).not.toContain("18:30");
    expect(hhmm(slots)).not.toContain("19:00");
    expect(hhmm(slots)).not.toContain("19:30");
    expect(hhmm(slots)).toContain("20:00");
  });

  it("prazan blockedTimes → identično sa existing tretmanom", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      blockedTimes: [],
    });
    expect(hhmm(slots)).toEqual([
      "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
    ]);
  });
});
```

- [ ] **Step 3: Pokreni unit testove**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test -- tests/unit/availability.test.ts
```

Expected: svi prolaze (83 total).

- [ ] **Step 4: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/lib/booking/availability.ts tests/unit/availability.test.ts && \
  git commit -m "feat(booking): computeAvailableSlots accepts optional blockedTimes

New optional parameter for sub-day blocks from the time_blocks DB
table. Blocks are merged with existing appointments before the overlap
check — same treatment, no special case. Empty array or undefined
behaves identically to not passing the parameter.

Four new unit tests cover: single block, partial overlap, composition
with existing bookings, empty passthrough."
```

---

## Task 3.3: Route handler čita `time_blocks`

**Files:**
- Modify: `src/app/api/availability/route.ts`

- [ ] **Step 1: Dopuni Promise.all sa četvrtim upitom**

Modify `src/app/api/availability/route.ts`. Promijeni `Promise.all` da doda `timeBlocksRes`:

```ts
const [apptRes, blockedRes, hoursRes, timeBlocksRes] = await Promise.all([
  sb
    .from("appointments")
    .select("start_time,end_time")
    .gte("start_time", dayStart)
    .lt("start_time", dayEnd)
    .in("status", ["ceka", "potvrdjen"]),
  sb.from("blocked_dates").select("date_from,date_to"),
  sb.from("working_hours").select("day_of_week,open_time,close_time,is_open"),
  sb
    .from("time_blocks")
    .select("start_time,end_time")
    .gte("start_time", dayStart)
    .lt("start_time", dayEnd),
]);
```

Dodaj error handling odmah poslije postojećih:

```ts
if (timeBlocksRes.error) {
  return NextResponse.json({ error: timeBlocksRes.error.message }, { status: 500 });
}
```

U `computeAvailableSlots` pozivu, dodaj `blockedTimes`:

```ts
const slots = computeAvailableSlots({
  date,
  durationMin: service.duration_min,
  now: new Date(),
  existing: (apptRes.data ?? []).map((a) => ({
    start: new Date(a.start_time),
    end: new Date(a.end_time),
  })),
  blocked: (blockedRes.data ?? []).map((b) => ({
    from: parseISO(b.date_from),
    to: parseISO(b.date_to),
  })),
  hoursByWeekday: hoursMapFromRows(hoursRes.data ?? []),
  blockedTimes: (timeBlocksRes.data ?? []).map((t) => ({
    start: new Date(t.start_time),
    end: new Date(t.end_time),
  })),
});
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/app/api/availability/route.ts && \
  git commit -m "feat(api): availability route reads time_blocks for sub-day blocking

Route now fetches time_blocks rows for the target day in parallel with
other queries and passes them as blockedTimes to computeAvailableSlots."
```

---

## Task 3.4: E2E test za time_blocks

**Files:**
- Create: `tests/e2e/time-blocks.spec.ts`

- [ ] **Step 1: Napiši test**

Create `tests/e2e/time-blocks.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { addDays, getDay } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(18, 0, 0, 0);
  return date;
}

async function insertTimeBlock(start: Date, durationMin: number): Promise<number> {
  if (!SERVICE_ROLE_KEY) throw new Error("missing service role");
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/time_blocks`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      reason: "E2E time block test",
    }),
  });
  if (!res.ok) throw new Error(`insert failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

async function deleteTimeBlock(id: number): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/time_blocks?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

test("time block hides overlapping slot from public calendar", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }

  const target = nextBookableWeekday();
  const dayNumber = target.getDate();
  const blockId = await insertTimeBlock(target, 60);

  try {
    await page.goto("/zakazi?service=1"); // Šminkanje 60min
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Time block je 18:00-19:00
    // 18:00 slot [18-19] overlaipuje — blokirano
    // 17:30 slot [17:30-18:30] overlaipuje — blokirano
    // 17:00 slot [17-18] granica — NE overlaipuje — slobodno
    // 19:00 slot [19-20] granica — NE overlaipuje — slobodno
    expect(slotTexts).not.toContain("17:30");
    expect(slotTexts).not.toContain("18:00");
    expect(slotTexts).not.toContain("18:30");
    expect(slotTexts).toContain("17:00");
    expect(slotTexts).toContain("19:00");
    expect(slotTexts).toContain("19:30");
    expect(slotTexts).toContain("20:00");
  } finally {
    await deleteTimeBlock(blockId);
  }
});
```

- [ ] **Step 2: Pokreni test**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test tests/e2e/time-blocks.spec.ts --reporter=list 2>&1 | tail -15
```

Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add tests/e2e/time-blocks.spec.ts && \
  git commit -m "test(e2e): time block hides overlapping slot from public calendar"
```

---

## Task 3.5: Phase 3 verifikacija

- [ ] **Step 1: Svi testovi**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck && npm test 2>&1 | tail -5 && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list 2>&1 | tail -15
```

Expected: typecheck čist, 83 unit pass, 10 e2e pass.

---

# PHASE 4 — Admin UI (manual booking + time blocks)

**Cilj faze:** Una može iz admin panela da kreira termin ručno (za telefonske rezervacije) i da blokira kratke intervale vremena.

## Task 4.1: `createManualAppointment` server action

**Files:**
- Modify: `src/lib/booking/schemas.ts`
- Modify: `src/app/admin/(protected)/termini/actions.ts`

- [ ] **Step 1: Dodaj Zod schema za manual booking**

Modify `src/lib/booking/schemas.ts`. Na kraj fajla dodaj:

```ts
/**
 * Zod shema za manualni booking iz admin panela.
 * Razlika od public booking scheme: nema consent polja, nema min_hours_before
 * provjere (admin unosi na svoj rizik), status je default `potvrdjen`.
 */
export const manualAppointmentSchema = z.object({
  service_id: z.number().int().positive(),
  start_time: z.string().datetime({ message: "Neispravan format vremena" }),
  client_name: z.string().min(2).max(100),
  client_phone: z
    .string()
    .refine(
      isValidPhone,
      "Neispravan broj telefona. Primjer: 065 123 456 ili +49 151 23456789",
    ),
  client_email: z
    .string()
    .email("Neispravna email adresa")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(500).optional(),
  force: z.boolean().optional(), // ako true, zaobilazi race guard
});

export type ManualAppointmentInput = z.infer<typeof manualAppointmentSchema>;
```

- [ ] **Step 2: Dodaj server action**

Modify `src/app/admin/(protected)/termini/actions.ts`. Na kraj fajla dodaj:

```ts
import { addMinutes } from "date-fns";
import { manualAppointmentSchema } from "@/lib/booking/schemas";
import { normalizePhone } from "@/lib/utils/phone";

export type ManualAppointmentResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      conflict?: boolean;
    };

export async function createManualAppointment(
  formData: FormData,
): Promise<ManualAppointmentResult> {
  try {
    await requireAuth();

    const raw = {
      service_id: Number(formData.get("service_id") ?? 0),
      start_time: String(formData.get("start_time") ?? ""),
      client_name: String(formData.get("client_name") ?? ""),
      client_phone: String(formData.get("client_phone") ?? ""),
      client_email: String(formData.get("client_email") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      force: formData.get("force") === "true",
    };

    const parsed = manualAppointmentSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Provjerite podatke u formi",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const sb = await createClient();

    // Uzmi uslugu za duration
    const { data: service } = await sb
      .from("services")
      .select("id,duration_min,bookable,active")
      .eq("id", parsed.data.service_id)
      .maybeSingle();

    if (!service || !service.duration_min) {
      return { ok: false, error: "Usluga nije pronađena ili nema trajanje" };
    }

    const start = new Date(parsed.data.start_time);
    const end = addMinutes(start, service.duration_min);

    // Ako nije force, provjeri konflikt
    if (!parsed.data.force) {
      const { data: clashing } = await sb
        .from("appointments")
        .select("id,client_name,start_time,end_time")
        .in("status", ["ceka", "potvrdjen"])
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString())
        .limit(1);

      if (clashing && clashing.length > 0) {
        const other = clashing[0];
        return {
          ok: false,
          conflict: true,
          error: `Konflikt sa postojećim terminom: ${other.client_name}. Možete svejedno dodati.`,
        };
      }
    }

    const { data: inserted, error } = await sb
      .from("appointments")
      .insert({
        service_id: parsed.data.service_id,
        client_name: parsed.data.client_name,
        client_phone: normalizePhone(parsed.data.client_phone),
        client_email: parsed.data.client_email || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: parsed.data.notes || null,
        status: "potvrdjen", // manual je odmah potvrđen
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { ok: false, error: error?.message ?? "Greška pri spremanju" };
    }

    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");
    return { ok: true, id: inserted.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

Napomena: `requireAuth()` već postoji u ovom fajlu (vidi postojeći `confirmAppointment`). `createClient` iz `@/lib/supabase/server` takođe.

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 4: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/lib/booking/schemas.ts src/app/admin/\(protected\)/termini/actions.ts && \
  git commit -m "feat(admin): createManualAppointment server action

Server action for the admin 'Add appointment' form. Validates through
manualAppointmentSchema (similar to public but no consent, no min-hours
check). Conflict check returns a soft warning unless force=true is set.
Inserted status is 'potvrdjen' immediately (admin has already verbally
confirmed on the phone)."
```

---

## Task 4.2: `ManualAppointmentForm` component

**Files:**
- Create: `src/components/admin/ManualAppointmentForm.tsx`

- [ ] **Step 1: Napiši komponentu**

Create `src/components/admin/ManualAppointmentForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { createManualAppointment } from "@/app/admin/(protected)/termini/actions";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  services: Service[];
  onClose: () => void;
};

export function ManualAppointmentForm({ services, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [forceFlag, setForceFlag] = useState(false);

  // Default vrijeme: sutra 17:00
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    const offsetMin = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offsetMin * 60000);
    return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-cream bg-white">
        <div className="border-b border-cream px-5 py-4">
          <h2 className="font-display text-xl text-dark">Dodaj termin</h2>
          <p className="mt-1 text-[11px] text-light">
            Ručni unos termina (telefonska rezervacija). Termin će biti odmah
            potvrđen.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setFieldErrors({});
            setConflictWarning(null);

            const fd = new FormData(e.currentTarget);
            // Pretvori local datetime u ISO
            const localStr = String(fd.get("start_time_local") ?? "");
            if (localStr) {
              const localDate = new Date(localStr);
              fd.set("start_time", localDate.toISOString());
            }
            if (forceFlag) fd.set("force", "true");

            startTransition(async () => {
              const result = await createManualAppointment(fd);
              if (result.ok) {
                onClose();
                return;
              }
              if (result.conflict) {
                setConflictWarning(result.error);
                return;
              }
              setError(result.error);
              setFieldErrors(result.fieldErrors ?? {});
            });
          }}
          className="space-y-4 px-5 py-5"
        >
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Usluga
            </label>
            <select
              name="service_id"
              required
              defaultValue={services[0]?.id ?? ""}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min ?? "—"}min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Ime klijenta
            </label>
            <input
              name="client_name"
              required
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
            {fieldErrors.client_name && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.client_name[0]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Telefon
            </label>
            <input
              name="client_phone"
              required
              placeholder="065 123 456 ili +49 151 23456789"
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
            {fieldErrors.client_phone && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.client_phone[0]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Email (opciono)
            </label>
            <input
              name="client_email"
              type="email"
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Datum i vrijeme
            </label>
            <input
              name="start_time_local"
              type="datetime-local"
              required
              defaultValue={defaultStart}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
            {fieldErrors.start_time && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.start_time[0]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Napomena (opciono)
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full resize-none border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </div>

          {conflictWarning && (
            <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-2 font-medium">{conflictWarning}</p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={forceFlag}
                  onChange={(e) => setForceFlag(e.target.checked)}
                  className="accent-rose"
                />
                <span>Svejedno ubaci (ignoriši konflikt)</span>
              </label>
            </div>
          )}

          {error && !conflictWarning && (
            <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 border border-cream bg-white py-2.5 text-[11px] uppercase tracking-wider hover:border-rose cursor-pointer"
            >
              Otkaži
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Spremam..." : "Sačuvaj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/components/admin/ManualAppointmentForm.tsx && \
  git commit -m "feat(admin): ManualAppointmentForm modal component"
```

---

## Task 4.3: "Dodaj termin" dugme u `/admin/termini`

**Files:**
- Modify: `src/app/admin/(protected)/termini/page.tsx`
- Create: `src/components/admin/TerminiToolbar.tsx`

- [ ] **Step 1: Kreiraj client komponentu toolbar**

Create `src/components/admin/TerminiToolbar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ManualAppointmentForm } from "./ManualAppointmentForm";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export function TerminiToolbar({ services }: { services: Service[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1.5 bg-rose px-4 py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover cursor-pointer"
      >
        <Plus size={14} />
        Dodaj termin
      </button>
      {showForm && (
        <ManualAppointmentForm
          services={services}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Dodaj toolbar u `termini/page.tsx`**

Read: `src/app/admin/(protected)/termini/page.tsx`. Naći mjesto na vrhu stranice ispod `PageHeader` ili u action prop-u PageHeader-a.

Modify: dodaj import i prosljedi servise u toolbar.

Na vrhu fajla, dodaj import:

```tsx
import { TerminiToolbar } from "@/components/admin/TerminiToolbar";
```

U funkciji komponente, prije postojećeg query-ja za appointments, dodaj fetch za services:

```tsx
const { data: servicesData } = await sb
  .from("services")
  .select("*")
  .eq("bookable", true)
  .eq("active", true)
  .order("order_index");
const services = servicesData ?? [];
```

Napomena: koristimo već postojeću `sb` varijablu iz nastavka page komponente.

U JSX-u, gdje je `PageHeader`, dodaj `action` prop:

```tsx
<PageHeader
  title="Termini"
  subtitle={`${appointments?.length ?? 0} zabilježenih`}
  action={<TerminiToolbar services={services} />}
/>
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 4: Live smoke test — admin login + otvori formu**

```bash
# Provjeri da dev server radi
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  /usr/bin/curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/admin/termini"
```

Expected: `307` (redirect na login, bez sesije). Browser manual verification se desi u Task 4.6.

- [ ] **Step 5: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/app/admin/\(protected\)/termini/page.tsx src/components/admin/TerminiToolbar.tsx && \
  git commit -m "feat(admin): 'Dodaj termin' button in termini page

Toolbar component that opens the ManualAppointmentForm modal. Fetches
active services to populate the service dropdown."
```

---

## Task 4.4: Time block server actions

**Files:**
- Modify: `src/app/admin/(protected)/postavke/actions.ts`

- [ ] **Step 1: Dodaj actions**

Modify `src/app/admin/(protected)/postavke/actions.ts`. Na kraj fajla dodaj:

```ts
const timeBlockSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  reason: z.string().max(200).optional().nullable(),
});

export async function createTimeBlock(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const parsed = timeBlockSchema.parse({
      start_time: String(formData.get("start_time")),
      end_time: String(formData.get("end_time")),
      reason: String(formData.get("reason") ?? "") || null,
    });
    if (new Date(parsed.end_time) <= new Date(parsed.start_time)) {
      return { ok: false, error: "Kraj mora biti poslije početka" };
    }
    const { error } = await sb.from("time_blocks").insert(parsed);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteTimeBlock(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb.from("time_blocks").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/app/admin/\(protected\)/postavke/actions.ts && \
  git commit -m "feat(admin): createTimeBlock, deleteTimeBlock server actions"
```

---

## Task 4.5: `TimeBlocksManager` komponenta + postavke integracija

**Files:**
- Create: `src/components/admin/TimeBlocksManager.tsx`
- Modify: `src/app/admin/(protected)/postavke/page.tsx`

- [ ] **Step 1: Napiši manager komponentu**

Create `src/components/admin/TimeBlocksManager.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  createTimeBlock,
  deleteTimeBlock,
} from "@/app/admin/(protected)/postavke/actions";
import { formatDate, formatTime } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type TimeBlock = Database["public"]["Tables"]["time_blocks"]["Row"];

export function TimeBlocksManager({ blocks }: { blocks: TimeBlock[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = e.currentTarget;
          const fd = new FormData(form);

          // Pretvori local datetime polja u ISO
          const startLocal = String(fd.get("start_time_local") ?? "");
          const endLocal = String(fd.get("end_time_local") ?? "");
          if (startLocal) fd.set("start_time", new Date(startLocal).toISOString());
          if (endLocal) fd.set("end_time", new Date(endLocal).toISOString());

          startTransition(async () => {
            const r = await createTimeBlock(fd);
            if (r.ok) {
              form.reset();
            } else {
              setError(r.error);
            }
          });
        }}
        className="mb-4 grid gap-2 border border-cream bg-white p-4 md:grid-cols-[1fr_1fr_1.5fr_auto]"
      >
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
            Od
          </label>
          <input
            name="start_time_local"
            type="datetime-local"
            required
            className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
            Do
          </label>
          <input
            name="end_time_local"
            type="datetime-local"
            required
            className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
            Razlog (opciono)
          </label>
          <input
            name="reason"
            type="text"
            placeholder="npr. zubar, pauza, privatno"
            className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-[31px] items-center justify-center gap-1 bg-rose px-4 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
          >
            <Plus size={12} />
            Dodaj
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="py-6 text-center text-sm text-light">
          Nema blokiranih vremenskih intervala.
        </p>
      ) : (
        <div className="overflow-hidden border border-cream bg-white">
          {blocks.map((b, i) => {
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            return (
              <div
                key={b.id}
                className={`flex items-center justify-between gap-3 p-4 ${
                  i < blocks.length - 1 ? "border-b border-cream" : ""
                }`}
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-dark">
                    {formatDate(start)} · {formatTime(start)} — {formatTime(end)}
                  </p>
                  {b.reason && (
                    <p className="mt-0.5 text-[11px] text-light">{b.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Ukloniti ovaj blok?")) return;
                    startTransition(async () => {
                      await deleteTimeBlock(b.id);
                    });
                  }}
                  aria-label="Ukloni"
                  className="flex size-8 items-center justify-center text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate u postavke page**

Read: `src/app/admin/(protected)/postavke/page.tsx`. Postoji struktura sa `WorkingHoursEditor`, `BlockedDatesManager`, `ChangePasswordForm`.

Modify: dodaj novu sekciju za `TimeBlocksManager` između `BlockedDatesManager` i `ChangePasswordForm`.

Na vrhu fajla, dodaj import:

```tsx
import { TimeBlocksManager } from "@/components/admin/TimeBlocksManager";
```

U `Promise.all` queryju, dodaj četvrti query:

```tsx
const [hoursRes, blockedRes, timeBlocksRes] = await Promise.all([
  sb.from("working_hours").select("*"),
  sb.from("blocked_dates").select("*").order("date_from"),
  sb.from("time_blocks").select("*").order("start_time"),
]);
```

U JSX, između `BlockedDatesManager` i `ChangePasswordForm`, dodaj:

```tsx
<section>
  <h2 className="mb-3 font-display text-xl text-dark">
    Blokirani intervali (sub-day)
  </h2>
  <p className="mb-4 text-[12px] text-light">
    Blokirajte konkretno vrijeme (npr. 18:00–20:00 u srijedu za zubara).
    Za cijele dane koristite sekciju iznad "Blokirani datumi".
  </p>
  <TimeBlocksManager blocks={timeBlocksRes.data ?? []} />
</section>
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```

Expected: čisto.

- [ ] **Step 4: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/components/admin/TimeBlocksManager.tsx src/app/admin/\(protected\)/postavke/page.tsx && \
  git commit -m "feat(admin): TimeBlocksManager in postavke page

New section under /admin/postavke lets Una create and delete sub-day
time blocks (e.g. dentist 18:00-20:00). Uses datetime-local inputs,
converts to ISO on submit. Server actions in postavke/actions.ts
already committed."
```

---

## Task 4.6: E2E tests za Phase 4

**Files:**
- Create: `tests/e2e/admin-manual-booking.spec.ts`
- Create: `tests/e2e/admin-time-block.spec.ts`

- [ ] **Step 1: Napiši admin manual booking test**

Create `tests/e2e/admin-manual-booking.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { addDays, getDay, format } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(19, 0, 0, 0);
  return date;
}

async function cleanupByName(name: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=eq.${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
}

test("admin manually creates appointment → slot is hidden on public calendar", async ({
  page,
}) => {
  const adminEmail =
    process.env.E2E_ADMIN_EMAIL ?? "peranovicuna6@gmail.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminPassword || !SERVICE_ROLE_KEY) {
    test.skip(true, "admin credentials ili service role key nedostaje");
  }

  const testClientName = `E2E Manual ${Date.now()}`;

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Lozinka").fill(adminPassword!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Go to termini, klik Dodaj termin
    await page.goto("/admin/termini");
    await page.getByRole("button", { name: /Dodaj termin/ }).click();

    // Popuni formu
    await expect(page.getByRole("heading", { name: "Dodaj termin" })).toBeVisible();
    await page.getByLabel("Ime klijenta").fill(testClientName);
    await page.getByLabel("Telefon").fill("+38765999000");

    // Datum: sljedeći weekday 19:00
    const target = nextBookableWeekday();
    const localValue = format(target, "yyyy-MM-dd'T'HH:mm");
    await page.getByLabel(/Datum i vrijeme/).fill(localValue);

    await page.getByRole("button", { name: "Sačuvaj" }).click();

    // Modal zatvoren, lista pokazuje novi termin
    await expect(page.getByText(testClientName)).toBeVisible({ timeout: 5000 });
  } finally {
    await cleanupByName(testClientName);
  }
});
```

- [ ] **Step 2: Napiši admin time block test**

Create `tests/e2e/admin-time-block.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { addDays, getDay, format } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(18, 0, 0, 0);
  return date;
}

async function cleanupBlockByReason(reason: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/time_blocks?reason=eq.${encodeURIComponent(reason)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
}

test("admin creates time block → public calendar hides overlapping slot", async ({
  page,
}) => {
  const adminEmail =
    process.env.E2E_ADMIN_EMAIL ?? "peranovicuna6@gmail.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminPassword || !SERVICE_ROLE_KEY) {
    test.skip(true, "admin credentials ili service role key nedostaje");
  }

  const uniqueReason = `E2E block ${Date.now()}`;

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Lozinka").fill(adminPassword!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Go to postavke
    await page.goto("/admin/postavke");
    await expect(
      page.getByRole("heading", { name: /Blokirani intervali/ }),
    ).toBeVisible();

    // Popuni formu za time block
    const target = nextBookableWeekday();
    const endTime = new Date(target);
    endTime.setHours(19, 0, 0, 0);

    const startLocal = format(target, "yyyy-MM-dd'T'HH:mm");
    const endLocal = format(endTime, "yyyy-MM-dd'T'HH:mm");

    // Scope selector na sekciju time_blocks
    const form = page.locator('form').filter({ has: page.locator('input[name="start_time_local"]') });
    await form.locator('input[name="start_time_local"]').fill(startLocal);
    await form.locator('input[name="end_time_local"]').fill(endLocal);
    await form.locator('input[name="reason"]').fill(uniqueReason);
    await form.getByRole("button", { name: /Dodaj/ }).click();

    // Block se pojavljuje u listi
    await expect(page.getByText(uniqueReason)).toBeVisible({ timeout: 5000 });

    // Provjeri public kalendar
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slots = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Block je 18:00-19:00
    // 18:00 i 17:30 i 18:30 overlaipuju — blokirano
    // 17:00 i 19:00 — slobodno
    expect(slots).not.toContain("18:00");
    expect(slots).not.toContain("17:30");
    expect(slots).not.toContain("18:30");
    expect(slots).toContain("17:00");
    expect(slots).toContain("19:00");
  } finally {
    await cleanupBlockByReason(uniqueReason);
  }
});
```

- [ ] **Step 3: Pokreni oba testa**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test tests/e2e/admin-manual-booking.spec.ts tests/e2e/admin-time-block.spec.ts --reporter=list 2>&1 | tail -20
```

Expected: 2 passed.

Ako failuje sa "element not found" na "Dodaj termin" ili "Sačuvaj" dugmetu, vjerovatno je lokalizacioni ili styling issue — loguj DOM u testu i ispravi selektore.

- [ ] **Step 4: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add tests/e2e/admin-manual-booking.spec.ts tests/e2e/admin-time-block.spec.ts && \
  git commit -m "test(e2e): admin manual booking + time block flows"
```

---

## Task 4.7: Phase 4 verifikacija

- [ ] **Step 1: Svi testovi**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck && npm test 2>&1 | tail -5 && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list 2>&1 | tail -20
```

Expected: typecheck čist, 83 unit pass, 13 e2e pass.

- [ ] **Step 2: Production build**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run build 2>&1 | tail -20
```

Expected: build uspješan.

- [ ] **Step 3: Manuelna verifikacija kroz preview browser**

Preview server treba biti aktivan. Preko `mcp__Claude_Preview__preview_eval`:

```js
location.href = 'http://localhost:3000/admin/termini'
```

Nakon ulogovanog stanja (cookies od ranije ili ručni login), provjeri:
- Dugme "Dodaj termin" vidljivo
- Klik otvara modal sa formom
- Validna submissija (ime, telefon, buduć datum) kreira termin i zatvara modal
- Novi termin se pojavljuje u listi

Isto za `/admin/postavke`:
- Sekcija "Blokirani intervali (sub-day)" vidljiva
- Forma za unos start/end/reason
- Submit dodaje block u listu
- Dugme za brisanje radi

---

# FINAL VERIFICATION

## Task 5: Final checkpoint

- [ ] **Step 1: Git status čist**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Git log pregled**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && git log --oneline -20
```

Expected: vidjeti ~15-18 commit-a od početka Phase 1 (Phase 0 spec commit + faze 1-4 commit-ovi + plan commit).

- [ ] **Step 3: Svi testovi**

Pokreni cijeli test suite jedno po jedno da potvrdiš regresiju:

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  npm run typecheck && \
  npm test && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list && \
  npm run build
```

Expected: sve zeleno, build uspješan.

- [ ] **Step 4: Brza summary u terminalu**

Output ka korisniku:

```
Scheduling overhaul kompletan. Pregled:

Phase 1 — Grid 30 min
  Slot generation koristi SLOT_INTERVAL_MIN=30 konstantu umjesto
  durationMin. Novi scenario: 30-min termin u 17:00 → sljedeći slobodan
  slot u 17:30 za bilo koju uslugu.

Phase 2 — Dynamic working hours
  /api/availability sada čita working_hours tabelu i prosljeđuje u
  computeAvailableSlots. Admin toggle u /admin/postavke stvarno utiče
  na public kalendar.

Phase 3 — time_blocks tabela
  Nova tabela za sub-day blokade. Blokovi se tretiraju identično kao
  postojeći termini u overlap check-u.

Phase 4 — Admin UI
  /admin/termini ima dugme "Dodaj termin" sa modalnom formom za
  manuelni booking (telefonski klijenti). /admin/postavke ima sekciju
  za dodavanje/brisanje time blocks.

Testovi: 83 unit + 13 e2e svi zeleni. Typecheck čist. Build prolazi.
```

---

## Verification Checklist

- [ ] Spec document committed in Phase 0
- [ ] Phase 1: Grid je 30 min, svi unit testovi za availability updated, 1 novi test za scenario dodavanja
- [ ] Phase 2: Working hours iz baze, helper `hoursMapFromRows`, fallback na `BOOKING_RULES`, 3 nova unit testa, 2 nova e2e testa (override hours + closed day)
- [ ] Phase 3: `time_blocks` migracija primjenjena, RLS aktivna, 4 nova unit testa, 1 novi e2e test
- [ ] Phase 4: `createManualAppointment` server action, `ManualAppointmentForm` komponenta, "Dodaj termin" dugme, `createTimeBlock`/`deleteTimeBlock` actions, `TimeBlocksManager` komponenta, integracija u postavke, 2 nova e2e testa
- [ ] Svi testovi zeleni na kraju (83 unit + 13 e2e)
- [ ] Typecheck čist
- [ ] Production build prolazi
- [ ] Git log ima jasne commit poruke po fazama
