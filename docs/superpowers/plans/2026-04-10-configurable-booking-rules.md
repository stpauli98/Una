# Configurable Booking Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una može iz admin panela da konfiguriše 4 booking pravila (min_hours_before, advance_booking_days, cancellation_hours, break_between_min) umjesto hardkodovanih konstanti.

**Architecture:** Nova `settings` key-value tabela u Supabase sa seed podacima. Helper `readBookingSettings()` čita i parsira. `computeAvailableSlots` prima `BookingSettings` kao opcioni parametar (fallback na `BOOKING_RULES`). Route handler čita iz baze. Admin UI je 4 dropdown-a u `/admin/postavke`. `break_between_min` se implementira proširivanjem overlap check-a.

**Tech Stack:** Supabase migracija, TypeScript, Vitest, Next.js 16 App Router server actions.

---

## File Structure

```
supabase/migrations/
  20260410_settings.sql                       ← CREATE (migracija + seed + RLS)

src/
  lib/settings/
    read.ts                                    ← CREATE (readBookingSettings helper)
  lib/booking/
    availability.ts                            ← MODIFY (prima BookingSettings, break_between_min)
  app/api/availability/route.ts                ← MODIFY (čita settings iz baze)
  app/admin/(protected)/postavke/
    actions.ts                                 ← MODIFY (updateSetting action)
    page.tsx                                   ← MODIFY (BookingRulesEditor sekcija)
  app/zakazi/uspjesno/page.tsx                 ← MODIFY (čita cancellation_hours iz baze)
  components/admin/
    BookingRulesEditor.tsx                      ← CREATE (4 dropdown-a)
  types/database.ts                            ← MODIFY (regenerate)

tests/unit/
  availability.test.ts                         ← MODIFY (testovi za break + settings param)
  settings.test.ts                             ← CREATE (readBookingSettings fallback)
```

---

## Task 1: DB migracija — `settings` tabela

**Files:**
- Create: `supabase/migrations/20260410_settings.sql`

- [ ] **Step 1: Napiši migraciju**

```sql
-- Settings key-value store za konfigurisana booking pravila.
-- Seed: 4 reda sa default vrijednostima iz BOOKING_RULES.

CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (key, value) VALUES
  ('min_hours_before', '24'),
  ('advance_booking_days', '90'),
  ('cancellation_hours', '24'),
  ('break_between_min', '0');

-- RLS: public read (availability engine), authenticated write (admin)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: public read"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "settings: authenticated full access"
  ON public.settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Primijeni migraciju na lokalni Docker**

```bash
docker exec -i supabase_db_up-beauty psql -U postgres -d postgres < \
  "/Users/nmil/Desktop/Una Peranovic/up-beauty/supabase/migrations/20260410_settings.sql"
```

Expected: `CREATE TABLE`, `INSERT 0 4`, `ALTER TABLE`, `CREATE POLICY` x2.

Potvrdi:
```bash
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c \
  "SELECT key, value FROM settings ORDER BY key;"
```

Expected:
```
         key          | value
----------------------+-------
 advance_booking_days | 90
 break_between_min    | 0
 cancellation_hours   | 24
 min_hours_before     | 24
```

- [ ] **Step 3: Primijeni na produkciju**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && supabase db push
```

- [ ] **Step 4: Regeneriši tipove**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  supabase gen types typescript --local 2>/dev/null > src/types/database.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260410_settings.sql src/types/database.ts && \
git commit -m "feat(db): settings key-value table for configurable booking rules

4 seed rows: min_hours_before, advance_booking_days, cancellation_hours,
break_between_min. Public read + authenticated full access RLS."
```

---

## Task 2: `readBookingSettings` helper

**Files:**
- Create: `src/lib/settings/read.ts`
- Create: `tests/unit/settings.test.ts`

- [ ] **Step 1: Napiši test**

Create `tests/unit/settings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseBookingSettings, type BookingSettings } from "@/lib/settings/read";

describe("parseBookingSettings", () => {
  it("parsira sve 4 ključa iz DB redova", () => {
    const rows = [
      { key: "min_hours_before", value: "6" },
      { key: "advance_booking_days", value: "30" },
      { key: "cancellation_hours", value: "12" },
      { key: "break_between_min", value: "10" },
    ];
    const result = parseBookingSettings(rows);
    expect(result).toEqual({
      minHoursBefore: 6,
      advanceBookingDays: 30,
      cancellationHours: 12,
      breakBetweenMin: 10,
    });
  });

  it("fallback na BOOKING_RULES default kad ključ nedostaje", () => {
    const rows = [
      { key: "min_hours_before", value: "3" },
      // ostali nedostaju
    ];
    const result = parseBookingSettings(rows);
    expect(result.minHoursBefore).toBe(3);
    expect(result.advanceBookingDays).toBe(90); // default
    expect(result.cancellationHours).toBe(24); // default
    expect(result.breakBetweenMin).toBe(0); // default
  });

  it("fallback na default kad je value neispravan (NaN)", () => {
    const rows = [
      { key: "min_hours_before", value: "abc" },
    ];
    const result = parseBookingSettings(rows);
    expect(result.minHoursBefore).toBe(24); // default
  });

  it("prazna lista → svi defaults", () => {
    const result = parseBookingSettings([]);
    expect(result).toEqual({
      minHoursBefore: 24,
      advanceBookingDays: 90,
      cancellationHours: 24,
      breakBetweenMin: 0,
    });
  });
});
```

- [ ] **Step 2: Run → FAIL**

```bash
npm test -- tests/unit/settings.test.ts
```

- [ ] **Step 3: Implementiraj helper**

Create `src/lib/settings/read.ts`:

```ts
import { BOOKING_RULES } from "@/lib/constants/business";

export type BookingSettings = {
  minHoursBefore: number;
  advanceBookingDays: number;
  cancellationHours: number;
  breakBetweenMin: number;
};

type SettingsRow = { key: string; value: string };

const DEFAULTS: BookingSettings = {
  minHoursBefore: BOOKING_RULES.min_hours_before,
  advanceBookingDays: BOOKING_RULES.advance_booking_days,
  cancellationHours: BOOKING_RULES.cancellation_hours,
  breakBetweenMin: BOOKING_RULES.break_between_min,
};

const KEY_MAP: Record<string, keyof BookingSettings> = {
  min_hours_before: "minHoursBefore",
  advance_booking_days: "advanceBookingDays",
  cancellation_hours: "cancellationHours",
  break_between_min: "breakBetweenMin",
};

/**
 * Parsira `settings` DB redove u tipizovani objekat.
 * Nedostajući ključevi ili neispravne vrijednosti → fallback na BOOKING_RULES.
 */
export function parseBookingSettings(rows: SettingsRow[]): BookingSettings {
  const result = { ...DEFAULTS };
  for (const row of rows) {
    const prop = KEY_MAP[row.key];
    if (!prop) continue;
    const num = Number(row.value);
    if (Number.isFinite(num) && num >= 0) {
      result[prop] = num;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run → PASS**

```bash
npm test -- tests/unit/settings.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings/read.ts tests/unit/settings.test.ts && \
git commit -m "feat(settings): parseBookingSettings helper with fallback

Pure function that maps settings DB rows to typed BookingSettings.
Falls back to BOOKING_RULES defaults for missing/invalid keys.
4 unit tests."
```

---

## Task 3: `computeAvailableSlots` prima `BookingSettings` + `break_between_min`

**Files:**
- Modify: `src/lib/booking/availability.ts`
- Modify: `tests/unit/availability.test.ts`

- [ ] **Step 1: Dodaj `settings` parametar u `AvailabilityInput`**

Modify `src/lib/booking/availability.ts`. Dodaj import na vrh:

```ts
import type { BookingSettings } from "@/lib/settings/read";
```

U `AvailabilityInput` tipu, dodaj:

```ts
  /**
   * Booking pravila iz `settings` tabele. Ako nije prosljeđeno,
   * koristi BOOKING_RULES konstante kao fallback.
   */
  settings?: BookingSettings;
```

- [ ] **Step 2: Zamijeni hardkodovane BOOKING_RULES reference**

U tijelu `computeAvailableSlots`, tri mjesta čitaju `BOOKING_RULES` direktno:

**Mjesto 1** (advance_booking_days, ~linija 78):

```ts
// Prije
if (daysAhead > BOOKING_RULES.advance_booking_days) return [];

// Poslije
const advanceDays = input.settings?.advanceBookingDays ?? BOOKING_RULES.advance_booking_days;
if (daysAhead > advanceDays) return [];
```

**Mjesto 2** (min_hours_before, ~linija 110):

```ts
// Prije
if (hoursFromNow < BOOKING_RULES.min_hours_before) {

// Poslije
const minHours = input.settings?.minHoursBefore ?? BOOKING_RULES.min_hours_before;
if (hoursFromNow < minHours) {
```

- [ ] **Step 3: Implementiraj break_between_min u overlap check**

U overlap check (~linija 117), dodaj buffer na end time:

```ts
// Prije
const allBlocking = [...existing, ...(input.blockedTimes ?? [])];
const overlaps = allBlocking.some(
  (item) => cursor < item.end && end > item.start,
);

// Poslije
const breakMin = input.settings?.breakBetweenMin ?? 0;
const allBlocking = [...existing, ...(input.blockedTimes ?? [])];
const overlaps = allBlocking.some((item) => {
  // Svaki postojeći termin efektivno traje duration + break_between_min
  const effectiveEnd = breakMin > 0 ? addMinutes(item.end, breakMin) : item.end;
  return cursor < effectiveEnd && end > item.start;
});
```

- [ ] **Step 4: Dodaj unit testove za settings parametar i break_between_min**

U `tests/unit/availability.test.ts`, dodaj novi describe blok:

```ts
import type { BookingSettings } from "@/lib/settings/read";

describe("computeAvailableSlots — configurable settings", () => {
  it("settings.advanceBookingDays override (30 dana umjesto 90)", () => {
    const now = day(2026, 4, 6);
    const target = new Date(now);
    target.setDate(target.getDate() + 35); // 35 dana u budućnosti
    const slots = computeAvailableSlots({
      date: target,
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
      settings: { minHoursBefore: 24, advanceBookingDays: 30, cancellationHours: 24, breakBetweenMin: 0 },
    });
    // 35 > 30 → prazno
    expect(slots).toEqual([]);
  });

  it("settings.minHoursBefore override (3h umjesto 24h)", () => {
    // now = utorak 18:00, target = srijeda
    const now = at(2026, 4, 7, 18, 0);
    const slots = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
      settings: { minHoursBefore: 3, advanceBookingDays: 90, cancellationHours: 24, breakBetweenMin: 0 },
    });
    // Sa 3h minHoursBefore: slot u 17:00 srijede je za 23h → OK (23 > 3)
    expect(hhmm(slots)).toContain("17:00");
    expect(hhmm(slots)).toContain("17:30");
  });

  it("break_between_min=10 → slot nakon termina pomjeren za 10 min", () => {
    // Postojeći termin 17:00-18:00. Sa 10 min break, efektivno 17:00-18:10.
    // 60-min slot na 17:30 [17:30-18:30] → overlaipuje sa [17:00-18:10] → blokirano
    // 60-min slot na 18:00 [18:00-19:00] → overlaipuje sa [17:00-18:10] → blokirano
    // 60-min slot na 18:30 [18:30-19:30] → ne overlaipuje (18:30 > 18:10) → slobodno
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17), end: at(2026, 4, 7, 18) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
      settings: { minHoursBefore: 24, advanceBookingDays: 90, cancellationHours: 24, breakBetweenMin: 10 },
    });
    expect(hhmm(slots)).not.toContain("17:00");
    expect(hhmm(slots)).not.toContain("17:30");
    expect(hhmm(slots)).not.toContain("18:00");
    expect(hhmm(slots)).toContain("18:30");
    expect(hhmm(slots)).toContain("19:00");
  });

  it("break_between_min=0 → identično sa bez break-a", () => {
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17), end: at(2026, 4, 7, 18) },
    ];
    const withBreak = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
      settings: { minHoursBefore: 24, advanceBookingDays: 90, cancellationHours: 24, breakBetweenMin: 0 },
    });
    const without = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
    });
    expect(hhmm(withBreak)).toEqual(hhmm(without));
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/unit/availability.test.ts
```

Expected: svi prolaze (postojeći + 4 nova).

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: svi prolaze.

- [ ] **Step 7: Commit**

```bash
git add src/lib/booking/availability.ts tests/unit/availability.test.ts && \
git commit -m "feat(booking): computeAvailableSlots reads from BookingSettings

New optional settings parameter replaces hardcoded BOOKING_RULES
references for min_hours_before and advance_booking_days. Also
implements break_between_min: existing appointments' end times are
extended by the break duration before overlap check.

4 new unit tests: advanceDays override, minHours override,
break=10 shifts next slot, break=0 unchanged."
```

---

## Task 4: Route handler čita `settings` iz baze

**Files:**
- Modify: `src/app/api/availability/route.ts`

- [ ] **Step 1: Dodaj settings query u Promise.all**

Modify `src/app/api/availability/route.ts`.

Dodaj import:
```ts
import { parseBookingSettings } from "@/lib/settings/read";
```

U `Promise.all`, dodaj peti query:
```ts
const [apptRes, blockedRes, hoursRes, timeBlocksRes, settingsRes] = await Promise.all([
  // ... 4 postojeća ...
  sb.from("settings").select("key,value"),
]);
```

Dodaj error handling:
```ts
if (settingsRes.error) {
  return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
}
```

U `computeAvailableSlots` pozivu, dodaj `settings`:
```ts
const bookingSettings = parseBookingSettings(settingsRes.data ?? []);

const slots = computeAvailableSlots({
  // ... postojeći params ...
  settings: bookingSettings,
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/availability/route.ts && \
git commit -m "feat(api): availability route reads booking settings from DB

Adds settings table to the parallel query bundle. Passes parsed
BookingSettings to computeAvailableSlots so min_hours_before,
advance_booking_days, and break_between_min are all dynamic."
```

---

## Task 5: Admin UI — `BookingRulesEditor` komponenta

**Files:**
- Create: `src/components/admin/BookingRulesEditor.tsx`
- Modify: `src/app/admin/(protected)/postavke/actions.ts`
- Modify: `src/app/admin/(protected)/postavke/page.tsx`

- [ ] **Step 1: Dodaj `updateSetting` server action**

Modify `src/app/admin/(protected)/postavke/actions.ts`. Na kraj fajla dodaj:

```ts
const ALLOWED_SETTING_KEYS = [
  "min_hours_before",
  "advance_booking_days",
  "cancellation_hours",
  "break_between_min",
] as const;

export async function updateSetting(
  key: string,
  value: string,
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    if (!(ALLOWED_SETTING_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: "Nepoznat ključ podešavanja" };
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return { ok: false, error: "Vrijednost mora biti nenegativan broj" };
    }
    const { error } = await sb
      .from("settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/postavke");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 2: Kreiraj `BookingRulesEditor` komponentu**

Create `src/components/admin/BookingRulesEditor.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateSetting } from "@/app/admin/(protected)/postavke/actions";

type SettingsMap = Record<string, string>;

const RULES = [
  {
    key: "min_hours_before",
    label: "Najranija rezervacija",
    description: "Koliko sati prije termina klijent može zakazati online.",
    options: [
      { value: "0", label: "Bez ograničenja" },
      { value: "1", label: "1 sat" },
      { value: "2", label: "2 sata" },
      { value: "3", label: "3 sata" },
      { value: "6", label: "6 sati" },
      { value: "12", label: "12 sati" },
      { value: "24", label: "24 sata" },
    ],
  },
  {
    key: "advance_booking_days",
    label: "Najdalja rezervacija",
    description: "Koliko dana unaprijed klijent može zakazati.",
    options: [
      { value: "7", label: "1 sedmica" },
      { value: "14", label: "2 sedmice" },
      { value: "30", label: "1 mjesec" },
      { value: "60", label: "2 mjeseca" },
      { value: "90", label: "3 mjeseca" },
    ],
  },
  {
    key: "cancellation_hours",
    label: "Besplatno otkazivanje",
    description: "Do koliko sati prije termina klijent može besplatno otkazati.",
    options: [
      { value: "0", label: "Bez ograničenja" },
      { value: "1", label: "1 sat" },
      { value: "2", label: "2 sata" },
      { value: "3", label: "3 sata" },
      { value: "6", label: "6 sati" },
      { value: "12", label: "12 sati" },
      { value: "24", label: "24 sata" },
    ],
  },
  {
    key: "break_between_min",
    label: "Pauza između termina",
    description: "Minuta pauze nakon svakog termina za čišćenje i pripremu.",
    options: [
      { value: "0", label: "Bez pauze" },
      { value: "5", label: "5 minuta" },
      { value: "10", label: "10 minuta" },
      { value: "15", label: "15 minuta" },
      { value: "30", label: "30 minuta" },
    ],
  },
] as const;

export function BookingRulesEditor({
  currentSettings,
}: {
  currentSettings: SettingsMap;
}) {
  return (
    <div className="space-y-3">
      {RULES.map((rule) => (
        <RuleRow
          key={rule.key}
          ruleKey={rule.key}
          label={rule.label}
          description={rule.description}
          options={rule.options}
          currentValue={currentSettings[rule.key] ?? ""}
        />
      ))}
    </div>
  );
}

function RuleRow({
  ruleKey,
  label,
  description,
  options,
  currentValue,
}: {
  ruleKey: string;
  label: string;
  description: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  currentValue: string;
}) {
  const [value, setValue] = useState(currentValue);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const changed = value !== currentValue;

  return (
    <div className="grid items-center gap-3 border border-cream bg-white p-4 md:grid-cols-[1fr_auto_auto]">
      <div>
        <p className="text-[13px] font-medium text-dark">{label}</p>
        <p className="mt-0.5 text-[11px] text-light">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-[10px] text-green-600">
            <Check size={12} /> Sačuvano
          </span>
        )}
        <button
          type="button"
          disabled={pending || !changed}
          onClick={() => {
            setSaved(false);
            startTransition(async () => {
              const r = await updateSetting(ruleKey, value);
              if (r.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }
            });
          }}
          className="bg-rose px-4 py-2 text-[10px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          {pending ? "..." : "Sačuvaj"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integriši u postavke page**

Modify `src/app/admin/(protected)/postavke/page.tsx`.

Dodaj import:
```tsx
import { BookingRulesEditor } from "@/components/admin/BookingRulesEditor";
```

U `Promise.all`, dodaj:
```tsx
const [hoursRes, blockedRes, timeBlocksRes, settingsRes] = await Promise.all([
  sb.from("working_hours").select("*"),
  sb.from("blocked_dates").select("*").order("date_from"),
  sb.from("time_blocks").select("*").order("start_time"),
  sb.from("settings").select("key,value"),
]);
```

Pretvori settings u map:
```tsx
const settingsMap: Record<string, string> = {};
for (const row of settingsRes.data ?? []) {
  settingsMap[row.key] = row.value;
}
```

U JSX, dodaj novu sekciju **na vrh** (prije "Radno vrijeme"):
```tsx
<section>
  <h2 className="mb-3 font-display text-xl text-dark">
    Pravila rezervisanja
  </h2>
  <p className="mb-4 text-[12px] text-light">
    Podesite koliko unaprijed i koliko kasno klijenti mogu zakazivati
    termine, te pauzu između termina za pripremu.
  </p>
  <BookingRulesEditor currentSettings={settingsMap} />
</section>
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BookingRulesEditor.tsx \
  src/app/admin/\(protected\)/postavke/actions.ts \
  src/app/admin/\(protected\)/postavke/page.tsx && \
git commit -m "feat(admin): BookingRulesEditor — 4 configurable dropdowns

New section 'Pravila rezervisanja' at top of /admin/postavke with
inline save per rule. updateSetting server action validates key
against allowlist and value as non-negative number.

Rules: min_hours_before, advance_booking_days, cancellation_hours,
break_between_min — each with curated dropdown options."
```

---

## Task 6: `/zakazi/uspjesno` čita `cancellation_hours` iz baze

**Files:**
- Modify: `src/app/zakazi/uspjesno/page.tsx`

- [ ] **Step 1: Dodaj settings query i prikaz**

Modify `src/app/zakazi/uspjesno/page.tsx`. Stranica već koristi `createAdminClient`.

Dodaj import:
```ts
import { parseBookingSettings } from "@/lib/settings/read";
```

Unutar `UspjesnoPage` funkcije, nakon fetch-a appointment-a, dodaj:
```ts
const { data: settingsRows } = await sb.from("settings").select("key,value");
const settings = parseBookingSettings(settingsRows ?? []);
```

Pronađi tekst koji pominje "24h za otkazivanje" ili slično i zamijeni sa dinamičkim:
```tsx
<p className="mt-1 text-[12px] text-light">
  Rezervacija postaje obavezujuća nakon Unine potvrde.
  {settings.cancellationHours > 0 && (
    <> Besplatno otkazivanje do {settings.cancellationHours}h prije termina.</>
  )}
</p>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/zakazi/uspjesno/page.tsx && \
git commit -m "feat(zakazi): success page reads cancellation_hours from settings

Dynamic display of cancellation policy instead of hardcoded '24h'."
```

---

## Task 7: Full verification + push

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 2: All unit tests**

```bash
npm test
```

Expected: 110 existing + 4 settings + 4 availability = ~118 pass.

- [ ] **Step 3: Production build**

```bash
npm run build
```

- [ ] **Step 4: Live verifikacija**

Admin login → `/admin/postavke`:
- Nova sekcija "Pravila rezervisanja" na vrhu sa 4 dropdown-a
- Promijeni "Najranija rezervacija" na "3 sata"
- Klikni Sačuvaj → zeleni check "Sačuvano"
- Otvori `/zakazi?service=1` → klijent sada vidi slotove koji su samo 3h unaprijed (umjesto 24h)

Break test:
- Postavi "Pauza između termina" na "10 minuta"
- Rezerviši termin u 17:00 (60 min)
- Provjeri public kalendar → slot 18:00 NEDOSTUPAN (jer break do 18:10), 18:30 dostupan

- [ ] **Step 5: Git push**

```bash
git push
```

---

## Verification Checklist

- [ ] `settings` tabela postoji u lokalnoj i produkcijskoj bazi sa 4 seed reda
- [ ] `parseBookingSettings` ima 4 unit testa za fallback/parsing
- [ ] `computeAvailableSlots` čita iz `settings` parametra za min_hours, advance_days, break
- [ ] `break_between_min` proširuje overlap check za pauzu
- [ ] `/api/availability` čita settings iz baze
- [ ] Admin UI ima 4 dropdown-a sa inline save
- [ ] `/zakazi/uspjesno` dinamički prikazuje cancellation_hours
- [ ] Svi testovi zeleni
- [ ] Typecheck čist
- [ ] Build prolazi
