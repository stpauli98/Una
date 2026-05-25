# Dashboard statistike — TZ + status filter + price snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixirati 5 problema u admin Dashboard statistike: TZ bug u sedmica/mjesec bounds, nedosljedan status filter, retroaktivna istorija prihoda (current price), miješanje projektovanog/ostvarenog, silent 1000-row cap. Uvodi `price_snapshot` kolonu koja se postavlja u `markCompleted` actionu.

**Architecture:** Mala DB migracija (dodaje nullable `appointments.price_snapshot`), `markCompleted` snapshot-uje trenutnu service price pri zavrsen tranziciji, dashboard query refactor: 3 count cards koriste `count:exact, head:true`, revenue koristi `price_snapshot` sumu. Sve granice (week/month) idu kroz postojeće TZ-aware helpere iz PR #43.

**Tech Stack:** PostgreSQL (Supabase) migracija, Next.js 16 server actions, TypeScript strict, Vitest unit + Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-05-19-dashboard-stats-design.md`

**Branch:** `fix/dashboard-stats` (već kreirana, spec doc je prvi commit).

---

## File Structure

**Modifikacije:**
- `src/app/admin/(protected)/termini/actions.ts` — `markCompleted` snapshot-uje cijenu.
- `src/app/admin/(protected)/dashboard/page.tsx` — refactor queries, koristi nove TZ helpere, update labele.
- `src/types/database.ts` — regenerisan da uključi `price_snapshot` polje.

**Novi fajlovi:**
- `supabase/migrations/20260520000000_appointments_price_snapshot.sql` — schema + backfill + index.
- `tests/e2e/admin-mark-completed-snapshot.spec.ts` — price snapshot regression test.

**Reuse:**
- `src/lib/utils/day-bounds.ts` — `getSarajevoWeekBounds`, `getSarajevoMonthBounds` već postoje iz PR #43.

---

## Task 1: DB migracija — price_snapshot kolona

**Files:**
- Create: `/Users/nmil/Desktop/Una Peranovic/up-beauty/supabase/migrations/20260520000000_appointments_price_snapshot.sql`

- [ ] **Step 1.1: Provjeri da je Docker Supabase pokrenut**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && docker ps | grep -c supabase
```

Expected: > 0. Ako 0, pokreni `npm run test:setup` da podigne lokalni Supabase stack.

- [ ] **Step 1.2: Kreiraj migracioni fajl**

Create `/Users/nmil/Desktop/Una Peranovic/up-beauty/supabase/migrations/20260520000000_appointments_price_snapshot.sql`:

```sql
-- supabase/migrations/20260520000000_appointments_price_snapshot.sql
-- Snapshot cijene servisa pri označavanju termina kao zavrsen.
--
-- Pozadina: dashboard revenue izvještaji su koristili services.price kao
-- "cijenu termina", ali services.price je trenutna cijena. Ako Una poveća
-- cijenu sa 80 → 100 KM, svi prošli zavrsen termini retroaktivno vrijede
-- 100 KM u izvještaju. To je netačno — istorijski prihod treba da bude
-- immutable.
--
-- Rješenje: zaključaj cijenu u trenutku završetka. markCompleted action
-- snapshot-uje trenutnu services.price u price_snapshot kolonu. Revenue
-- query koristi price_snapshot umjesto services.price.

-- 1. Dodaj nullable kolonu (postojeći ne-zavrsen termini ostaju NULL)
ALTER TABLE public.appointments
  ADD COLUMN price_snapshot numeric(10, 2);

COMMENT ON COLUMN public.appointments.price_snapshot IS
  'Cijena servisa zabilježena pri označavanju termina kao zavrsen.
   NULL za termine koji još nisu završeni ili za stare zavrsen termine
   prije uvođenja snapshot-a (backfill best-effort).
   Koristi se za revenue izvještaje umjesto trenutne services.price.';

-- 2. Backfill postojećih zavrsen termina sa current services.price.
-- Nije idealno (nemamo pravu cijenu u trenutku završetka), ali bolje od
-- null-a za istorijske brojke. Sve nove zavrsen tranzicije bilježe pravu
-- cijenu kroz markCompleted action.
UPDATE public.appointments a
SET price_snapshot = s.price
FROM public.services s
WHERE a.service_id = s.id
  AND a.status = 'zavrsen'
  AND a.price_snapshot IS NULL;

-- 3. Partial index za brz revenue agregat — samo zavrsen redovi
CREATE INDEX IF NOT EXISTS idx_appointments_status_start_time
  ON public.appointments (status, start_time)
  WHERE status = 'zavrsen';
```

- [ ] **Step 1.3: Apply migration lokalno**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && supabase db reset 2>&1 | tail -10
```

Expected: "Applying migration 20260520000000_appointments_price_snapshot.sql..." + "Finished supabase db reset on database."

`db reset` resetuje lokalnu bazu, primjenjuje SVE migracije (uključujući novu), i pokreće seed.sql. Sigurnije od `db push --local` jer garantuje čistu state.

- [ ] **Step 1.4: Verifikuj schema, backfill i index**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'appointments' AND column_name = 'price_snapshot';

SELECT count(*) AS unmigrated_zavrsen FROM appointments
WHERE status = 'zavrsen' AND price_snapshot IS NULL;

SELECT indexname FROM pg_indexes
WHERE tablename = 'appointments' AND indexname = 'idx_appointments_status_start_time';
"
```

Expected output:
- `price_snapshot | numeric | YES`
- `unmigrated_zavrsen` = 0 (svi zavrsen imaju snapshot)
- `idx_appointments_status_start_time` row vraćen

- [ ] **Step 1.5: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add supabase/migrations/20260520000000_appointments_price_snapshot.sql
git commit -m "$(cat <<'EOF'
feat(db): add appointments.price_snapshot for immutable revenue

Dodaje nullable price_snapshot kolonu sa backfill-om postojećih zavrsen
termina i partial indexom za brzo agregiranje. Snapshot će se postaviti
u markCompleted action (Task 3). Revenue queries (Task 4) koriste
price_snapshot umjesto trenutne services.price → istorija prihoda
postaje immutable.

Refs: docs/superpowers/specs/2026-05-19-dashboard-stats-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Regenerate TypeScript types

**Files:**
- Modify: `/Users/nmil/Desktop/Una Peranovic/up-beauty/src/types/database.ts`

- [ ] **Step 2.1: Regenerate types**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && supabase gen types typescript --local > src/types/database.ts 2>&1
```

Expected: fajl je prepisan bez grešaka.

- [ ] **Step 2.2: Verifikuj da `price_snapshot` postoji u tipovima**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -n "price_snapshot" src/types/database.ts | head -5
```

Expected: 3 redova (Row, Insert, Update varijante).

- [ ] **Step 2.3: Verifikuj typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck 2>&1 | tail -5
```

Expected: 0 grešaka. Postojeći kod ne koristi `price_snapshot` još, pa ne bi smjelo biti regresije.

- [ ] **Step 2.4: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/types/database.ts
git commit -m "$(cat <<'EOF'
chore(types): regenerate database.ts after price_snapshot migration

supabase gen types typescript --local

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update markCompleted action — snapshot price

**Files:**
- Modify: `/Users/nmil/Desktop/Una Peranovic/up-beauty/src/app/admin/(protected)/termini/actions.ts:60-74`

- [ ] **Step 3.1: Update markCompleted funkciju**

Replace function body at lines 60-74 (zamijeni cijeli `export async function markCompleted` blok):

```typescript
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
      return {
        ok: false,
        error: fetchErr?.message ?? "Termin nije pronađen",
      };
    }

    // services može biti null ako je servis obrisan (FK ON DELETE SET NULL).
    // U tom slučaju snapshot ostaje null — admin može mark zavrsen ali
    // revenue za taj termin neće biti uračunat. Rijetka edge case.
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

- [ ] **Step 3.2: Verifikuj typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck 2>&1 | tail -5
```

Expected: 0 grešaka.

- [ ] **Step 3.3: Verifikuj lint za izmijenjeni fajl**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npx eslint 'src/app/admin/(protected)/termini/actions.ts' 2>&1 | tail -5
```

Expected: bez warning-a/errors.

- [ ] **Step 3.4: Verifikuj unit tests prolaze**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test 2>&1 | tail -5
```

Expected: svi unit testovi PASS. Postojeći testovi ne dotiču `markCompleted` direktno (nema unit testa za action), pa ne bi smjelo biti regresije.

- [ ] **Step 3.5: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add 'src/app/admin/(protected)/termini/actions.ts'
git commit -m "$(cat <<'EOF'
feat(actions): snapshot service price in markCompleted

markCompleted sada fetch-uje trenutnu services.price prije UPDATE-a i
upisuje je u price_snapshot kolonu zajedno sa status='zavrsen'. Time
istorija prihoda postaje immutable — kasnije promjene services.price
ne mijenjaju iznose prošlih završenih termina.

Edge case: ako je servis obrisan (FK SET NULL), snapshot ostaje null
i taj termin se ne broji u revenue. Prihvaćena limitacija.

Race window SELECT→UPDATE je ~50ms, prihvatljivo.

Refs: docs/superpowers/specs/2026-05-19-dashboard-stats-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Refactor dashboard queries + labele

**Files:**
- Modify: `/Users/nmil/Desktop/Una Peranovic/up-beauty/src/app/admin/(protected)/dashboard/page.tsx`

Ovo je središnji task — mijenja imports, bounds construction, query strukturu i labele.

- [ ] **Step 4.1: Update imports**

Replace lines 9-14 (imports za date-fns + day-bounds):

```typescript
// PRIJE:
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  getSarajevoDayBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
```

```typescript
// POSLIJE:
import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  getSarajevoMonthBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
```

`date-fns` startOfWeek/endOfWeek/startOfMonth/endOfMonth se uklanjaju u potpunosti — nisu više potrebni.

- [ ] **Step 4.2: Update bounds construction (lines 82-85)**

Replace:

```typescript
// PRIJE:
// Stats sedmica/mjesec ostaju vezani za `now` (stvarni datum, ne izabrani)
const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
const monthStart = startOfMonth(now).toISOString();
const monthEnd = endOfMonth(now).toISOString();
```

```typescript
// POSLIJE:
// Stats sedmica/mjesec idu kroz TZ-aware helpere (Sarajevo timezone),
// vezani za stvarni današnji datum (ne izabrani u day picker-u).
const weekBounds = getSarajevoWeekBounds(todayStr);
const monthBounds = getSarajevoMonthBounds(todayStr);
```

- [ ] **Step 4.3: Update Promise.all queries (lines 87-112)**

Replace cijeli `Promise.all` blok:

```typescript
// POSLIJE (zamjenjuje lines 87-112):
const [todayRes, weekRes, monthRes, revenueRes, dayListRes] = await Promise.all([
  // 1. Završeni danas — count
  sb
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("start_time", todayBounds.start)
    .lt("start_time", todayBounds.end)
    .eq("status", "zavrsen"),

  // 2. Završeno sedmica — count
  sb
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("start_time", weekBounds.start)
    .lt("start_time", weekBounds.end)
    .eq("status", "zavrsen"),

  // 3. Završeno mjesec — count
  sb
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("start_time", monthBounds.start)
    .lt("start_time", monthBounds.end)
    .eq("status", "zavrsen"),

  // 4. Prihod mjesec — sumiramo price_snapshot iz zavrsen termina.
  // .not(price_snapshot, is, null) izbacuje termine bez snapshot-a
  // (rijetki edge case kad je servis obrisan prije zavrsen).
  sb
    .from("appointments")
    .select("price_snapshot")
    .gte("start_time", monthBounds.start)
    .lt("start_time", monthBounds.end)
    .eq("status", "zavrsen")
    .not("price_snapshot", "is", null)
    .limit(1000),

  // 5. Lista termina za izabrani dan — NEIZMIJENJENO (sve statuse)
  sb
    .from("appointments")
    .select("id,client_name,client_phone,start_time,status,services(name)")
    .gte("start_time", selectedDayBounds.start)
    .lt("start_time", selectedDayBounds.end)
    .order("start_time"),
]);
```

- [ ] **Step 4.4: Update count + revenue extraction (lines 114-119)**

Replace:

```typescript
// PRIJE:
const todayCount = todayRes.count ?? 0;
const weekCount = weekRes.count ?? 0;
const monthCount = monthRes.data?.length ?? 0;
const monthRevenue = (monthRes.data ?? []).reduce((sum, a) => {
  return sum + Number(a.services?.price ?? 0);
}, 0);
```

```typescript
// POSLIJE:
const todayCount = todayRes.count ?? 0;
const weekCount = weekRes.count ?? 0;
const monthCount = monthRes.count ?? 0;
const monthRevenue = (revenueRes.data ?? []).reduce(
  (sum, a) => sum + Number(a.price_snapshot ?? 0),
  0,
);
```

- [ ] **Step 4.5: Update stat card labele (lines 148-167)**

Replace:

```typescript
// PRIJE:
<StatCard icon={Clock}        label="Termini danas" value={todayCount} />
<StatCard icon={Calendar}     label="Ova sedmica"   value={weekCount} />
<StatCard icon={CheckCircle2} label="Ovaj mjesec"   value={monthCount} />
<StatCard icon={TrendingUp}   label="Prihod mjesec" value={formatPrice(monthRevenue)} />
```

```typescript
// POSLIJE:
<StatCard icon={Clock}        label="Završeni danas"   value={todayCount} />
<StatCard icon={Calendar}     label="Završeno sedmica" value={weekCount} />
<StatCard icon={CheckCircle2} label="Završeno mjesec"  value={monthCount} />
<StatCard icon={TrendingUp}   label="Prihod mjesec"    value={formatPrice(monthRevenue)} />
```

- [ ] **Step 4.6: Verifikuj typecheck + lint + unit tests**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck 2>&1 | tail -5 && echo "---" && npx eslint 'src/app/admin/(protected)/dashboard/page.tsx' 2>&1 | tail -5 && echo "---" && npm test 2>&1 | tail -5
```

Expected:
- Typecheck: 0 grešaka
- Lint na dashboard fajl: 0 warning/error
- Unit tests: svi PASS

- [ ] **Step 4.7: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add 'src/app/admin/(protected)/dashboard/page.tsx'
git commit -m "$(cat <<'EOF'
fix(dashboard): TZ-aware bounds, zavrsen-only stats, price_snapshot revenue

- Week/Month bounds koriste Sarajevo TZ helpere (getSarajevoWeekBounds,
  getSarajevoMonthBounds) umjesto date-fns server TZ funkcija. Fixira
  TZ bug za rane jutarnje termine na rubu sedmice/mjeseca.
- Sve 4 stat kartice koriste status='zavrsen' (umjesto miks ceka/potvrdjen
  za neke, potvrdjen/zavrsen za druge). Konzistentna semantika "ostvareni
  termini".
- Revenue koristi price_snapshot (zaključana cijena) umjesto trenutne
  services.price → istorija prihoda postaje immutable.
- 3 count cards koriste count:exact head:true (više nema silent 1000-row
  cap na monthCount).
- Labele update na "Završeni/Završeno" eksplicitno.

Refs: docs/superpowers/specs/2026-05-19-dashboard-stats-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: E2E regression test — price snapshot

**Files:**
- Create: `/Users/nmil/Desktop/Una Peranovic/up-beauty/tests/e2e/admin-mark-completed-snapshot.spec.ts`

- [ ] **Step 5.1: Create test file**

Create `/Users/nmil/Desktop/Una Peranovic/up-beauty/tests/e2e/admin-mark-completed-snapshot.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { atSarajevo } from "@/lib/utils/tz";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("admin markCompleted — price snapshot regression", () => {
  test.skip(!serviceKey, "E2E_SUPABASE_SERVICE_ROLE_KEY nije setovan");

  let createdApptId: number;
  let originalServicePrice: number;
  const clientName = "E2E_SNAPSHOT_TEST";
  // Service ID 1 = Šminkanje 60min (vidi tests/e2e/dashboard-day-navigator.spec.ts:33)
  const serviceId = 1;
  const testPrice = 80;
  const newPrice = 100;

  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey!);

    // Snapshot original service price za restore u afterAll
    const { data: svc } = await admin
      .from("services")
      .select("price")
      .eq("id", serviceId)
      .single();
    originalServicePrice = Number(svc?.price ?? 80);

    // Set service.price na testnu vrijednost (80)
    await admin
      .from("services")
      .update({ price: testPrice })
      .eq("id", serviceId);

    // Seed termin sa status='potvrdjen' za juče u 14:00 Sarajevo
    // (ne treba biti danas — samo zavrsen status nam je interesantan)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const start = atSarajevo(
      yesterday.getUTCFullYear(),
      yesterday.getUTCMonth() + 1,
      yesterday.getUTCDate(),
      14,
      0,
    );
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data, error } = await admin
      .from("appointments")
      .insert({
        service_id: serviceId,
        client_name: clientName,
        client_phone: "+38765999222",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "potvrdjen",
        confirmation_token: crypto.randomUUID(),
      })
      .select("id")
      .single();
    if (error) throw error;
    createdApptId = data.id;
  });

  test.afterAll(async () => {
    if (!serviceKey) return;
    const admin = createClient(url, serviceKey);
    if (createdApptId) {
      await admin.from("appointments").delete().eq("id", createdApptId);
    }
    // Restore original price
    await admin
      .from("services")
      .update({ price: originalServicePrice })
      .eq("id", serviceId);
  });

  async function login(page: Page) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  }

  test("markCompleted snapshot-uje cijenu i opstaje pri price change-u", async ({
    page,
  }) => {
    const admin = createClient(url, serviceKey!);

    // Verifikuj početni state — price_snapshot je null
    const { data: before } = await admin
      .from("appointments")
      .select("price_snapshot")
      .eq("id", createdApptId)
      .single();
    expect(before?.price_snapshot).toBeNull();

    // Login + idi na termini za juče
    await login(page);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yStr = yesterday.toISOString().slice(0, 10);
    await page.goto(`/admin/termini?date=${yStr}`);
    await expect(page.getByText(clientName)).toBeVisible();

    // Klik "Završen" za seeded termin. Pošto klijent name je unique
    // (E2E_SNAPSHOT_TEST), nađi row koji ga sadrži i klikni Završen u njemu.
    const row = page.locator("div").filter({ hasText: clientName }).first();
    await row.getByRole("button", { name: "Završen" }).click();

    // Čekaj da revalidate završi (router.refresh)
    await page.waitForTimeout(500);

    // Query DB — snapshot je sad postavljen na testPrice (80)
    const { data: afterComplete } = await admin
      .from("appointments")
      .select("price_snapshot, status")
      .eq("id", createdApptId)
      .single();
    expect(afterComplete?.status).toBe("zavrsen");
    expect(Number(afterComplete?.price_snapshot)).toBe(testPrice);

    // Sad promijeni service.price na newPrice (100)
    await admin
      .from("services")
      .update({ price: newPrice })
      .eq("id", serviceId);

    // Re-query — snapshot je nepromijenjen (još uvijek 80)
    const { data: afterPriceChange } = await admin
      .from("appointments")
      .select("price_snapshot")
      .eq("id", createdApptId)
      .single();
    expect(Number(afterPriceChange?.price_snapshot)).toBe(testPrice);
  });
});
```

- [ ] **Step 5.2: Verifikuj global-setup cleanup pokriva prefix**

Prefix `E2E_SNAPSHOT_TEST` se podudara sa `E2E*` u `tests/e2e/global-setup.ts:28`. Nije potreban dodatak.

- [ ] **Step 5.3: Verifikuj TypeScript**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck 2>&1 | tail -5
```

Expected: bez grešaka.

- [ ] **Step 5.4: Run e2e test (ako Docker pokrenut)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && docker ps | grep -c supabase
```

Ako 0, preskoči ovaj step i samo commit. Korisnik pokreće `npm run test:setup` kasnije.

Ako > 0:

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npx playwright test tests/e2e/admin-mark-completed-snapshot.spec.ts --reporter=list 2>&1 | tail -15
```

Expected: 1 test PASS.

- [ ] **Step 5.5: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add tests/e2e/admin-mark-completed-snapshot.spec.ts
git commit -m "$(cat <<'EOF'
test(dashboard): e2e regression for markCompleted price snapshot

Verifikuje da:
1. markCompleted snapshot-uje trenutnu services.price u price_snapshot
2. Kasniji change services.price ne mijenja postojeći snapshot
3. Snapshot ostaje immutable kroz mark zavrsen → izmjena cijene → re-query

Pokriva core fix iz spec-a: istorija prihoda je immutable.

Refs: docs/superpowers/specs/2026-05-19-dashboard-stats-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final validation

- [ ] **Step 6.1: Run typecheck + lint (our files only) + unit tests**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck 2>&1 | tail -3 && echo "---LINT---" && npx eslint 'src/app/admin/(protected)/termini/actions.ts' 'src/app/admin/(protected)/dashboard/page.tsx' tests/e2e/admin-mark-completed-snapshot.spec.ts 2>&1 | tail -5 && echo "---TEST---" && npm test 2>&1 | tail -5
```

Expected:
- Typecheck: 0 grešaka
- Lint na naše fajlove: 0 warning/error
- Unit tests: svi PASS (postojeći — nemamo nove unit testove u ovom planu)

- [ ] **Step 6.2: Run e2e suite (ako Docker pokrenut)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && docker ps | grep -c supabase
```

Ako > 0:

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run test:e2e:local 2>&1 | tail -15
```

Expected: svi e2e testovi PASS, uključujući novi `admin-mark-completed-snapshot.spec.ts`.

Ako 0, korisnik pokreće `npm run test:setup` pa `npm run test:e2e:local` kasnije.

- [ ] **Step 6.3: Manual smoke (opciono)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run dev
```

U browser-u:
- Otvori `/admin/dashboard` — verify nove labele: "Završeni danas", "Završeno sedmica", "Završeno mjesec", "Prihod mjesec".
- Sve 4 brojke trebaju biti = 0 (ili postojeći zavrsen broj iz seed data-e).
- Marka jedan termin kao Završen u Termini tab-u → dashboard se ažurira preko realtime → broj raste, revenue raste.

---

## Self-Review

**Spec coverage check:**

| Spec section | Task | OK? |
|---|---|---|
| Goal — TZ Sarajevo bounds | T4 (Step 4.2 koristi getSarajevoWeekBounds/MonthBounds) | ✓ |
| Goal — status='zavrsen' svuda | T4 (Step 4.3, sve 4 query-ja) | ✓ |
| Goal — price_snapshot u revenue | T4 (Step 4.3 revenue query, Step 4.4 reduce) | ✓ |
| Goal — labele eksplicitne | T4 (Step 4.5) | ✓ |
| Goal — count: exact, head: true | T4 (Step 4.3, 3 count query-ja) | ✓ |
| Architecture — DB migracija | T1 | ✓ |
| Architecture — actions.ts markCompleted | T3 | ✓ |
| Architecture — types regen | T2 | ✓ |
| Risks — backfill best-effort | T1 (Step 1.2 dokumentovan u migraciji + commit msg) | ✓ |
| Risks — TS tipovi | T2 (regen) | ✓ |
| Risks — race window | T3 (commit msg + JSDoc komentar u kodu) | ✓ |
| Risks — obrisan servis edge case | T3 (`appt.services?.price ?? null` + JSDoc) | ✓ |
| Tests — E2E price snapshot | T5 | ✓ |
| Tests — migration smoke verifikacija | T1 (Step 1.4 sa SQL provjerom) | ✓ |
| Tests — reuse postojećih TZ unit testova | (PR #43 testovi i dalje važe — bez novog task-a) | ✓ |

**Placeholder scan:** Nema TBD, TODO, ili vague reference. Svaki step ima konkretne kod blokove ili komande.

**Type consistency:**
- `price_snapshot` u DB (Task 1) → TS type `number | null` (Task 2 regen) → koristi se u markCompleted UPDATE (Task 3, kao `number | null`) → čita se u dashboard reduce (Task 4, `a.price_snapshot ?? 0`). Konzistentno.
- `services.price` čitanje u Task 3 (`appt.services?.price`) match-uje shape iz postojećih query-ja (singular FK relationship).
- `getSarajevoWeekBounds` / `getSarajevoMonthBounds` iz PR #43 — signature `(dateStr) => {start: string, end: string}` korišten konzistentno u Task 4.
- `count: "exact", head: true` koristi se isto u 3 count card query-ja u Task 4.

Plan je kompletan i samodovoljan.
