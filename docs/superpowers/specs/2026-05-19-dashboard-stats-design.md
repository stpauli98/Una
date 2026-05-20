# Dashboard statistike — TZ, status filter, price snapshot — Design

**Status:** Draft (awaiting user review)
**Date:** 2026-05-19
**Author:** Nikola Milošević + Claude Opus 4.7

## Problem

`src/app/admin/(protected)/dashboard/page.tsx` ima 4 stat kartica ("Termini danas", "Ova sedmica", "Ovaj mjesec", "Prihod mjesec") sa 5 problema:

**1. TZ bug (sedmica/mjesec).** Koriste `startOfWeek(now)`, `endOfWeek(now)`, `startOfMonth(now)`, `endOfMonth(now)` iz `date-fns`, što radi u server TZ. Na Vercel-u (UTC) granice su pomjerene 1-2h od Sarajeva. Termini na ranojutarnjem rubu sedmice/mjeseca ispadaju/ulaze pogrešno. Isti pattern bug-a kao u Termini tabu (već fix-an u PR #43) — ali dashboard nije pokriven.

**2. Status filter nedosljedan.** Tri varijante kroz 3 query-ja:
- "Termini danas" + "Ova sedmica" → `IN ('ceka', 'potvrdjen')`
- "Ovaj mjesec" + "Prihod mjesec" → `IN ('potvrdjen', 'zavrsen')`

Posljedica: sedmica i mjesec ne brojaju iste tipove termina. Termin u status=ceka u petak je u "sedmici" ali NIJE u "mjesecu".

**3. Termini danas counter se smanjuje.** Kako admin tokom dana mark-uje termine kao zavrsen, brojač pada (jer filter zaglavljen na ceka+potvrdjen). U 09:00 stoji "5", do 17:00 "1". User-confusing.

**4. Revenue koristi trenutnu service.price.** Ako Una promijeni cijenu servisa sa 80 na 100 KM, svi prošli završeni termini retroaktivno vrijede 100 KM u izvještajima. Computational time-travel — istorija mjesečnog prihoda se mijenja unazad.

**5. Revenue + count miješaju "ostvareno" sa "projektovanim".** Status=potvrdjen znači "klijent dogovorio, još nije bio" — to nije ostvareni prihod ali se broji kao da jest.

**Bonus:** Month query (`monthRes`) ne koristi `count: exact, head: true` — fetcha rows. Supabase default cap ~1000 znači silent gubitak ako Una ikada pređe 1000 termina/mjesec.

## Goals

- Sve granice (week/month) u Sarajevo TZ — konzistentno sa Termini fix-om iz PR #43.
- Jedinstven status filter: **samo `zavrsen`** za sva 4 stat-a. Brojevi predstavljaju "ostvarene termine" semantiku.
- Revenue koristi snapshot-ovanu cijenu u trenutku završetka, ne trenutnu cijenu servisa. Istorija prihoda postaje immutable.
- Eksplicitne labele kartica — "Završeni danas", "Završeno sedmica", "Završeno mjesec", "Prihod mjesec" — user ne mora pogađati semantiku.
- Count cards koriste `count: exact, head: true` umjesto fetch+length.

## Non-goals

- Promjena UI/UX layouta dashboard-a (stat cards layout, day picker, listu termina ispod).
- Promjena dnevne liste termina (`dayListRes`) — pokazuje SVE statuse za izabrani dan kao prije.
- Dodatak novih stat kartica (npr. "zakazani danas" pored "završeni danas").
- Historical price tracking za prošle cijene servisa (van scope-a — backfill koristi current price kao best-effort).
- Atomski transaction garantije za `markCompleted` (race window ~50ms je prihvatljiv).
- Promjena `confirmAppointment` ili `cancelAppointment` (snapshot je samo `zavrsen` događaj).

## Architecture

```
supabase/migrations/
└── 20260520000000_appointments_price_snapshot.sql   [NEW]

src/app/admin/(protected)/termini/
└── actions.ts                                        [EDIT — markCompleted snapshot logic]

src/app/admin/(protected)/dashboard/
└── page.tsx                                          [EDIT — queries, bounds, labels]

src/lib/utils/
└── day-bounds.ts                                     [već ima week/month bounds iz PR #43]

src/types/
└── database.ts                                       [REGEN — supabase gen types]

tests/e2e/
└── admin-mark-completed-snapshot.spec.ts             [NEW]
```

**Granice odgovornosti:**
- DB migracija — schema + backfill.
- `actions.ts` — `markCompleted` snapshot-uje cijenu pri zavrsen tranziciji.
- `dashboard/page.tsx` — orchestrator: 4 paralelna query-ja, sva sa Sarajevo TZ bounds + `status='zavrsen'`.

Postojeći `getSarajevoWeekBounds` i `getSarajevoMonthBounds` (iz PR #43) se reuse — nema novih TZ helpera.

## DB Migration

`supabase/migrations/20260520000000_appointments_price_snapshot.sql`:

```sql
-- Dodaje price_snapshot za appointment-e tako da revenue izvještaji
-- ne zavise od trenutne services.price (koja se može mijenjati i pogađati
-- istoriju retroaktivno).

ALTER TABLE public.appointments
  ADD COLUMN price_snapshot numeric(10, 2);

COMMENT ON COLUMN public.appointments.price_snapshot IS
  'Cijena servisa zabilježena pri označavanju termina kao zavrsen.
   NULL za termine koji još nisu završeni ili za stare zavrsen termine
   prije uvođenja snapshot-a (backfill best-effort).
   Koristi se za revenue izvještaje umjesto trenutne services.price.';

-- Backfill postojećih zavrsen termina. Nije idealno (nemamo pravu cijenu
-- u trenutku završetka), ali bolje od null-a za istorijske brojke.
UPDATE public.appointments a
SET price_snapshot = s.price
FROM public.services s
WHERE a.service_id = s.id
  AND a.status = 'zavrsen'
  AND a.price_snapshot IS NULL;

-- Partial index za brz revenue agregat — samo zavrsen redovi
CREATE INDEX IF NOT EXISTS idx_appointments_status_start_time
  ON public.appointments (status, start_time)
  WHERE status = 'zavrsen';
```

**Razlozi:**
- **Nullable kolona** — postojeći ne-zavrsen termini ostaju NULL, ne forsiramo non-null constraint koji bi pukao postojeće redove.
- **Backfill samo `zavrsen`** — drugi statusi nemaju semantičnog razloga za snapshot.
- **`numeric(10, 2)`** — match-uje `services.price` tip iz init schema.
- **Partial index** — manji i brži za revenue queries koje uvijek filtriraju `status='zavrsen'`.

## actions.ts izmjena

```typescript
// src/app/admin/(protected)/termini/actions.ts

export async function markCompleted(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();

    // Fetch current service price za snapshot
    const { data: appt, error: fetchErr } = await sb
      .from("appointments")
      .select("services(price)")
      .eq("id", id)
      .single();

    if (fetchErr || !appt) {
      return { ok: false, error: fetchErr?.message ?? "Termin nije pronađen" };
    }

    // services može biti null ako je servis obrisan (FK ON DELETE SET NULL).
    // U tom slučaju snapshot ostaje null — admin može mark zavrsen ali revenue
    // za taj termin neće biti uračunat. Rijetka edge case, prihvatamo.
    const priceSnapshot = appt.services?.price ?? null;

    const { error: updateErr } = await sb
      .from("appointments")
      .update({
        status: "zavrsen",
        price_snapshot: priceSnapshot,
      })
      .eq("id", id);

    if (updateErr) return { ok: false, error: updateErr.message };

    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

**Race window:** Između SELECT i UPDATE postoji ~50ms gap u kojem cijena servisa može biti promijenjena. U praksi nemoguće ručno izazvati (admin kontroliše oba endpointa, klikne jedno za drugim). Atomski RPC funkcija je overkill.

**Cancel ne dira snapshot:** `cancelAppointment` ostaje neizmijenjen. Ako admin slučajno markaju zavrsen pa otkaže, snapshot ostaje u DB-u ali revenue ga ne broji (filter status='zavrsen'). Ako termin ikad vrati u zavrsen, snapshot ostaje **stara cijena** — intencionalno, "cijena pri prvom završetku".

## Dashboard page.tsx izmjena

### Query refactor

```typescript
// Imports — dodati week/month bounds
import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  getSarajevoMonthBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";

// Bounds — sve Sarajevo TZ
const todayBounds = getSarajevoDayBounds(todayStr);
const weekBounds = getSarajevoWeekBounds(todayStr);
const monthBounds = getSarajevoMonthBounds(todayStr);

const [todayRes, weekRes, monthRes, revenueRes, dayListRes] = await Promise.all([
  // 1. Završeni danas
  sb.from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("start_time", todayBounds.start)
    .lt("start_time", todayBounds.end)
    .eq("status", "zavrsen"),

  // 2. Završeno sedmica
  sb.from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("start_time", weekBounds.start)
    .lt("start_time", weekBounds.end)
    .eq("status", "zavrsen"),

  // 3. Završeno mjesec (count)
  sb.from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("start_time", monthBounds.start)
    .lt("start_time", monthBounds.end)
    .eq("status", "zavrsen"),

  // 4. Prihod mjesec — agregat price_snapshot
  sb.from("appointments")
    .select("price_snapshot")
    .gte("start_time", monthBounds.start)
    .lt("start_time", monthBounds.end)
    .eq("status", "zavrsen")
    .not("price_snapshot", "is", null)
    .limit(1000),

  // 5. Lista termina za izabrani dan (sve statuse) — NEIZMIJENJENO
  sb.from("appointments")
    .select("id,client_name,client_phone,start_time,status,services(name)")
    .gte("start_time", selectedDayBounds.start)
    .lt("start_time", selectedDayBounds.end)
    .order("start_time"),
]);

const todayCount = todayRes.count ?? 0;
const weekCount = weekRes.count ?? 0;
const monthCount = monthRes.count ?? 0;
const monthRevenue = (revenueRes.data ?? []).reduce(
  (sum, a) => sum + Number(a.price_snapshot ?? 0),
  0,
);
```

### Labele

```typescript
<StatCard icon={Clock}        label="Završeni danas"   value={todayCount} />
<StatCard icon={Calendar}     label="Završeno sedmica" value={weekCount} />
<StatCard icon={CheckCircle2} label="Završeno mjesec"  value={monthCount} />
<StatCard icon={TrendingUp}   label="Prihod mjesec"    value={formatPrice(monthRevenue)} />
```

### Summary izmjena vs trenutni kod

| Šta | Prije | Sad |
|---|---|---|
| Week bounds | `startOfWeek(now)` server TZ | `getSarajevoWeekBounds(todayStr)` Sarajevo TZ |
| Month bounds | `startOfMonth(now)` server TZ | `getSarajevoMonthBounds(todayStr)` Sarajevo TZ |
| End operator | `lte` | `lt` (exclusive, konzistentno) |
| Status filter (svi) | mix od `IN('ceka','potvrdjen')` ili `IN('potvrdjen','zavrsen')` | `= 'zavrsen'` svuda |
| Month count | `monthRes.data?.length` (silent 1000 cap) | `count: exact, head: true` |
| Revenue source | `services.price` (trenutna) | `price_snapshot` (zaključana) |
| Revenue queries | 1 (mixed sa count) | Posebna od count query-ja |

## Testing strategy

### Postojeća pokrivenost (reuse)

- `getSarajevoWeekBounds` / `getSarajevoMonthBounds` — Task 1/2 testovi iz PR #43 pokrivaju DST proljeće/jesen, prestupne februare, godinu granice, mid-week/Monday/Sunday inputs, invalid inputs. ✓
- `formatPrice` — `tests/unit/format.test.ts` ✓

### Novo: E2E test za price snapshot

`tests/e2e/admin-mark-completed-snapshot.spec.ts`:

Scenario verifikuje da:
1. `markCompleted` snapshot-uje trenutnu service.price
2. Snapshot je immutable — kasniji change service.price ne mijenja snapshot
3. Dashboard revenue koristi snapshot, ne trenutnu cijenu

Steps:
1. Seed termin u zavrsen-relevant past datumu (npr. juče) sa service_id koji ima price=80. Početni status='potvrdjen'.
2. Login admin.
3. Goto `/admin/termini?date=<juče>`, klik "Završen" za seeded termin.
4. Query DB direktno: `price_snapshot` == 80.
5. Update `services.price` na 100 (direct DB ili admin UI).
6. Re-query: `price_snapshot` još uvijek 80 (ne mijenja se sa servisom).
7. Goto `/admin/dashboard`, verify "Prihod mjesec" reflects 80 KM doprinosa, ne 100.

Cleanup: delete seeded termin, restore service.price na 80. Use `E2E_*` prefix za auto-cleanup.

### Migration smoke verifikacija

Nakon `supabase db push`, ručna provjera:

```sql
-- Kolona postoji
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'appointments' AND column_name = 'price_snapshot';

-- Backfill prošao
SELECT count(*) FROM appointments
WHERE status = 'zavrsen' AND price_snapshot IS NULL;
-- Expected: 0

-- Index postoji
SELECT indexname FROM pg_indexes
WHERE indexname = 'idx_appointments_status_start_time';
```

## Risks

- **Backfill je best-effort.** Postojeći zavrsen termini dobijaju current service.price, ne pravu cijenu u trenutku završetka. Sve nove zavrsen tranzicije bilježe pravu cijenu. Akceptabilno jer aplikacija je nova i istorijski prihod izvještaji su retroaktivno netačni u istom smjeru kao i prije.
- **TS tipovi.** Nakon migracije treba `supabase gen types typescript` (lokalno ili remote) i regenerisati `src/types/database.ts`. Bez toga `price_snapshot` neće biti tipiziran i `markCompleted` UPDATE call će izazvati type error.
- **Race window u markCompleted.** ~50ms gap između SELECT i UPDATE. Nemoguće ručno izazvati, ali teorijski race ako admin koristi automatske skripte protiv API-ja.
- **Revenue za servise obrisane mid-cycle.** Ako admin obriše servis (`FK ON DELETE SET NULL`), termini koji su markirani zavrsen prije brisanja imaju snapshot ✓. Ali termini markirani zavrsen **nakon** brisanja servisa će imati `price_snapshot=null` → ne brojaju se u prihodu. Prihvatljiv edge case (rijetko).

## Open questions

Nema. Sve odluke su donijete kroz brainstorming:
- Scope: TZ + status filter + price snapshot, single PR.
- Status filter: samo `zavrsen` za sva 4 stat-a.
- Price strategija: snapshot pri završetku (markCompleted action).
- Labele: update na "Završeni/Završeno" eksplicitno.
- Testovi: E2E za snapshot, reuse postojećih TZ unit testova.
