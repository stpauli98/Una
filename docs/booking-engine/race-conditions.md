# Race conditions — sprjecavanje duplog booking-a

Dva klijenta istovremeno biraju isti slot. **Samo jedan smije da uspije.**

## Trobranska odbrana

```
┌──────────────────────────────┐
│  1. UI provjera (klijent)    │  ← Mekano: vidi samo dostupne slotove
│                              │
│  2. Race guard (server)      │  ← Srednje: SELECT prije INSERT
│                              │
│  3. DB constraint (Postgres) │  ← Tvrdo: EXCLUDE USING gist
└──────────────────────────────┘
```

## Sloj 1: UI provjera

`/api/availability` vraća samo dostupne slotove. Klijent vidi listu, klikne jedan.

**Problem:** Između klikova klijenta A i B može proći vrijeme. B-jeva lista još ne zna da je A već kliknuo.

## Sloj 2: Race guard

**Fajl:** `src/app/zakazi/actions.ts` u `createAppointment()`:

```typescript
// Race guard: provjeri da se slot nije upravo zauzeo
const { data: clashing, error: clashErr } = await sb
  .from("appointments")
  .select("id")
  .in("status", ["ceka", "potvrdjen"])
  .lt("start_time", end.toISOString())
  .gt("end_time", start.toISOString())
  .limit(1);

if (clashErr) {
  return { ok: false, error: "Greška pri provjeri termina..." };
}
if (clashing && clashing.length > 0) {
  return {
    ok: false,
    error: "Ovaj termin je upravo zauzet. Vratite se i izaberite drugi slobodan termin.",
  };
}

// Ako nema clash → INSERT
INSERT INTO appointments (...) VALUES (...);
```

### TOCTOU vulnerability

**Time-Of-Check vs Time-Of-Use:**

```
T1: Klijent A: SELECT clash → empty
T2: Klijent B: SELECT clash → empty (jer A još nije INSERT-ovao)
T3: Klijent A: INSERT → success
T4: Klijent B: INSERT → SUCCESS (!) — oba imaju isti slot
```

Race guard sam **ne sprjecava** ovo. Treba sloj 3.

## Sloj 3: DB exclusion constraint

**Migracija:** `supabase/migrations/20260411100000_no_overlapping.sql`

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('ceka', 'potvrdjen'));
```

### Šta radi

PostgreSQL `EXCLUDE USING gist` constraint sa `tstzrange` operatorom:
- Pravi index po `start_time..end_time` rangeu
- Constraint: nijedna dva reda (sa statusom ceka/potvrdjen) ne smiju imati preklapajuće rangeove
- Operator `&&` (overlap) primijenjen
- `WHERE` clause: samo active appointments

### Atomic INSERT check

Postgres provjerava constraint **atomic** sa INSERT-om:

```
T3: Klijent A: INSERT → Postgres lock-uje range index → success
T4: Klijent B: INSERT → Postgres detektuje overlap → ERROR (constraint violation)
```

Bez race condition. Klijent B dobija grešku:

```
duplicate key value violates exclusion constraint "no_overlapping_appointments"
```

### Tretiranje constraint error-a

```typescript
const { data: inserted, error: insErr } = await sb
  .from("appointments")
  .insert({ ... })
  .select("id")
  .single();

if (insErr || !inserted) {
  console.error("appointment insert failed:", insErr);
  return {
    ok: false,
    error: "Došlo je do greške pri spremanju. Molimo pokušajte ponovo.",
  };
}
```

Trenutno se ne razlikuje constraint violation od drugih grešaka. Klijent dobija "greška, pokušajte ponovo". Možemo poboljšati sa specific message-om za `23P01` Postgres error code.

## btree_gist extension

Standardni gist index podržava range types. `btree_gist` proširenje dodaje "scalar" tipove (kao integer ili text) u gist indekse.

U našem slučaju ne treba scalar — samo `tstzrange`. `EXCLUDE USING gist` može raditi sa range bez `btree_gist`. Ali iz opreza, ekstenzija je uključena.

## Performance

Range index je efikasan:
- INSERT: O(log n) za constraint check
- SELECT (race guard): O(log n) jer postoji `idx_appointments_active_range` (line 32 u init schema)

Sa 1000 termina, oba operacije < 1ms.

## Drugi race conditions

### Una briše uslugu dok klijent rezerviše

```
T1: Klijent: GET /zakazi → vidi uslugu
T2: Una: DELETE service
T3: Klijent: POST createAppointment(service_id=42)
T4: Server: SELECT service WHERE id=42 → null → ERROR
```

`createAppointment` provjerava service prije insert-a:

```typescript
const { data: service } = await sb
  .from("services")
  .select("id, duration_min, bookable, active")
  .eq("id", parsed.data.service_id)
  .maybeSingle();

if (!service) return { ok: false, error: "Usluga nije pronađena" };
```

Klijent dobija grešku. Edge case ali handle-uje se.

### Una mijenja radno vrijeme dok klijent bira slot

```
T1: Klijent: GET /api/availability → 19:30 dostupan
T2: Una: UPDATE working_hours SET close_time = '19:00'
T3: Klijent: POST createAppointment(start_time=19:30)
T4: Server: race guard prolazi (nema clash), INSERT prolazi (nema constraint)
T5: Slot postoji iako je sad van radnog vremena
```

**Trenutno se ne validira** working hours u `createAppointment`. Hipotetski mogli dodati, ali rijetko se dešava i nije security risk.

### Klijent submit-uje 2x (race u browseru)

```
T1: Klijent klikne "Potvrdi" 2x brzo
T2: Browser šalje 2 POST request-a
T3: Server: 2 paralelna createAppointment
T4: Prvi prolazi, drugi → constraint violation
```

UI bi trebao disable-ovati dugme nakon prvog click-a. Server bi trebao biti idempotent (ali trenutno nije — dva pokušaja se tretiraju nezavisno).

**Trenutno:** Klijent dobija "Ovaj termin je upravo zauzet" za drugi pokušaj. Funkcionalno OK.

## Testovi

### Unit

`tests/unit/availability.test.ts` ne testira race conditions (pure function, nema baze).

### E2E

`tests/e2e/double-booking.spec.ts`:

```typescript
// Seed: Klijent A rezerviše slot
const idA = await insertAppointment(1, target, 60, "E2E Double A");

// Klijent B otvara booking UI
await page.goto("/zakazi?service=1");
await page.getByRole("button", { name: String(dayNumber) }).click();

// 17:00 NE smije biti dostupan
const slotTexts = await page.getByRole("button").filter({ hasText: /^\d{2}:\d{2}$/ }).allTextContents();
expect(slotTexts).not.toContain("17:00");
```

### Manual stress test (TBD)

Nije implementiran. Mogli bismo simulirati 2 parallel POST request-a i provjeriti da samo jedan prolazi.

## Sledeće

- [confirmation-token.md](./confirmation-token.md) — UUID anti-IDOR
- [../security/rls-policies.md](../security/rls-policies.md) — RLS na appointments
