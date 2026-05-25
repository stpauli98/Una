# Termini — TZ-aware filteri, paginacija, cookie merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixirati 4 problema u admin Termini tabu (page.tsx): TZ bug u range filterima, nekonzistentna bounds semantika, nedostatak limita za "svi", sve-ili-ništa cookie fallback. Sve uz modular extract testabilne logike iz page komponente.

**Architecture:** Tri nova/proširena helpera u `src/lib/utils/`: `day-bounds.ts` (week/month bounds), `admin-prefs.ts` (resolveTerminiPrefs + computeDefaultSort), novi `termini-filters.ts` (buildAppointmentsBoundsFilter). Page.tsx postaje tanki orchestrator: `cookies → resolve → bounds → query → render`.

**Tech Stack:** TypeScript strict, Next.js 16 App Router, Supabase JS, `date-fns-tz` (postojeća dep), Vitest unit, Playwright e2e. Sve TZ aritmetika ide preko podneva da bi bila DST-safe.

**Spec:** `docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md`

**Branch:** `fix/termini-tz-filters` (već kreirana, spec doc je prvi commit).

---

## File Structure

**Modifikacije:**
- `src/lib/utils/day-bounds.ts` — dodati `getSarajevoWeekBounds` i `getSarajevoMonthBounds`.
- `src/lib/utils/admin-prefs.ts` — dodati `ResolvedTerminiPrefs` tip, `computeDefaultSort`, `resolveTerminiPrefs`.
- `src/app/admin/(protected)/termini/page.tsx` — refaktorisati da koristi nove helpere + paginacija + indikator.

**Novi fajlovi:**
- `src/lib/utils/termini-filters.ts` — `buildAppointmentsBoundsFilter`.
- `tests/unit/termini-filters.test.ts` — unit testovi za bounds filter.
- `tests/e2e/admin-termini-tz.spec.ts` — TZ regression test.

**Proširivanje testova:**
- `tests/unit/day-bounds.test.ts` — dodati `describe` blokove za nove funkcije.
- `tests/unit/admin-prefs.test.ts` — dodati testove za nove funkcije.

---

## Task 1: getSarajevoWeekBounds

**Files:**
- Modify: `src/lib/utils/day-bounds.ts` (dodati funkciju nakon `getSarajevoDayBounds`, prije `sarajevoTodayDateStr`).
- Modify: `tests/unit/day-bounds.test.ts` (dodati `describe("getSarajevoWeekBounds", ...)`).

- [ ] **Step 1.1: Write failing tests**

Append to `tests/unit/day-bounds.test.ts` (prije zatvarajuće zagrade fajla):

```typescript
describe("getSarajevoWeekBounds", () => {
  it("vraća ponedjeljak 00:00 — sljedeći ponedjeljak 00:00 za mid-week datum", () => {
    // 2026-05-20 = srijeda. Ponedjeljak iste sedmice = 2026-05-18.
    const { start, end } = getSarajevoWeekBounds("2026-05-20");
    // Maj = CEST (UTC+2), Sarajevo ponoć = 22:00 UTC prethodnog dana
    expect(start).toBe("2026-05-17T22:00:00.000Z"); // 2026-05-18 00:00 CEST
    expect(end).toBe("2026-05-24T22:00:00.000Z");   // 2026-05-25 00:00 CEST
  });

  it("input je sam ponedjeljak — start je taj dan", () => {
    const { start, end } = getSarajevoWeekBounds("2026-05-18");
    expect(start).toBe("2026-05-17T22:00:00.000Z");
    expect(end).toBe("2026-05-24T22:00:00.000Z");
  });

  it("input je nedjelja — vraća prethodni ponedjeljak", () => {
    // 2026-05-24 = nedjelja. Ponedjeljak iste sedmice = 2026-05-18.
    const { start, end } = getSarajevoWeekBounds("2026-05-24");
    expect(start).toBe("2026-05-17T22:00:00.000Z");
    expect(end).toBe("2026-05-24T22:00:00.000Z");
  });

  it("DST proljeće — sedmica koja sadrži spring-forward (29. mart 2026)", () => {
    // 29. mart 2026 = nedjelja DST start. Sedmica: pon 23. mart → pon 30. mart.
    const { start, end } = getSarajevoWeekBounds("2026-03-29");
    // 23. mart 00:00 CET = 23:00 UTC 22. marta
    expect(start).toBe("2026-03-22T23:00:00.000Z");
    // 30. mart 00:00 CEST = 22:00 UTC 29. marta
    expect(end).toBe("2026-03-29T22:00:00.000Z");
  });

  it("DST jesen — sedmica koja sadrži fall-back (25. okt 2026)", () => {
    // 25. okt 2026 = nedjelja DST end. Sedmica: pon 19. okt → pon 26. okt.
    const { start, end } = getSarajevoWeekBounds("2026-10-25");
    // 19. okt 00:00 CEST = 22:00 UTC 18. okt
    expect(start).toBe("2026-10-18T22:00:00.000Z");
    // 26. okt 00:00 CET = 23:00 UTC 25. okt
    expect(end).toBe("2026-10-25T23:00:00.000Z");
  });

  it("sedmica preko godine (decembar 2026 → januar 2027)", () => {
    // 2026-12-30 = srijeda. Sedmica: pon 28. dec 2026 → pon 4. jan 2027.
    const { start, end } = getSarajevoWeekBounds("2026-12-30");
    // Decembar = CET (UTC+1)
    expect(start).toBe("2026-12-27T23:00:00.000Z");
    expect(end).toBe("2027-01-03T23:00:00.000Z");
  });

  it("baca grešku za neispravan datum", () => {
    expect(() => getSarajevoWeekBounds("not-a-date")).toThrow();
    expect(() => getSarajevoWeekBounds("2026-13-01")).toThrow();
  });
});
```

Import line već postoji, ali treba dodati `getSarajevoWeekBounds`:

```typescript
import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
```

- [ ] **Step 1.2: Run tests, verify they fail**

```bash
cd up-beauty && npm test -- tests/unit/day-bounds.test.ts
```

Expected: 7 failures u `getSarajevoWeekBounds` describe-u sa "getSarajevoWeekBounds is not a function" ili sličnom porukom.

- [ ] **Step 1.3: Implement getSarajevoWeekBounds**

Modify `src/lib/utils/day-bounds.ts`. Dodati funkciju **nakon** `getSarajevoDayBounds` (poslije linije 53), **prije** `sarajevoTodayDateStr`:

```typescript
/**
 * Vraća Sarajevo sedmične granice (ponedjeljak 00:00 — sljedeći ponedjeljak 00:00)
 * kao ISO UTC stringove. End je exclusive (koristi se sa `gte/lt` u DB query-ju).
 *
 * Input: bilo koji YYYY-MM-DD dateStr unutar te sedmice. Funkcija sama nađe
 * ponedjeljak. DST-safe (sva aritmetika ide preko podneva kao bazne tačke).
 */
export function getSarajevoWeekBounds(dateStr: string): {
  start: string;
  end: string;
} {
  assertIsoDate(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  // Podne kao baza — daleko od DST tranzicija (uvijek 02:00/03:00)
  const noon = atSarajevo(y, m, d, 12, 0);
  // ISO dan: 1=Mon, 7=Sun
  const isoDay = parseInt(formatInTimeZone(noon, TZ, "i"), 10);
  // Pomak unazad do ponedjeljka kroz podne
  const mondayNoon = new Date(
    noon.getTime() - (isoDay - 1) * 24 * 60 * 60 * 1000,
  );
  const mondayDateStr = formatInTimeZone(mondayNoon, TZ, "yyyy-MM-dd");
  // Sljedeći ponedjeljak = mondayNoon + 7 dana, pa format → datum
  const nextMondayNoon = new Date(
    mondayNoon.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
  const nextMondayDateStr = formatInTimeZone(
    nextMondayNoon,
    TZ,
    "yyyy-MM-dd",
  );
  // Ponoć iz date string-ova (zna DST tačno)
  const [my, mm, md] = mondayDateStr.split("-").map(Number);
  const [ny, nm, nd] = nextMondayDateStr.split("-").map(Number);
  return {
    start: atSarajevo(my, mm, md, 0, 0).toISOString(),
    end: atSarajevo(ny, nm, nd, 0, 0).toISOString(),
  };
}
```

- [ ] **Step 1.4: Run tests, verify they pass**

```bash
cd up-beauty && npm test -- tests/unit/day-bounds.test.ts
```

Expected: svih 7 testova u `getSarajevoWeekBounds` PASS. Postojeći testovi za druge funkcije i dalje PASS.

- [ ] **Step 1.5: Commit**

```bash
cd up-beauty && git add src/lib/utils/day-bounds.ts tests/unit/day-bounds.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): add getSarajevoWeekBounds for TZ-aware week filtering

Slijedi pattern getSarajevoDayBounds — sva aritmetika ide preko podneva
da bi bila DST-safe. Vraća ISO UTC stringove sa exclusive end semantikom
(gte/lt). Pokriva pon→pon prelaz, DST proljeće/jesen, godinu granice.

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md (A, B)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: getSarajevoMonthBounds

**Files:**
- Modify: `src/lib/utils/day-bounds.ts` (dodati funkciju nakon `getSarajevoWeekBounds`).
- Modify: `tests/unit/day-bounds.test.ts` (dodati `describe("getSarajevoMonthBounds", ...)`).

- [ ] **Step 2.1: Write failing tests**

Append `describe` block u `tests/unit/day-bounds.test.ts` (prije zatvarajuće zagrade fajla):

```typescript
describe("getSarajevoMonthBounds", () => {
  it("vraća 1. dan mjeseca 00:00 — 1. sljedećeg mjeseca 00:00 (mid-month input)", () => {
    // 2026-05-15 unutar maja → start = 2026-05-01, end = 2026-06-01
    const { start, end } = getSarajevoMonthBounds("2026-05-15");
    // Maj = CEST (UTC+2), ponoć = 22:00 UTC prethodnog dana
    expect(start).toBe("2026-04-30T22:00:00.000Z");
    expect(end).toBe("2026-05-31T22:00:00.000Z");
  });

  it("input je 1. dan mjeseca — start je taj dan", () => {
    const { start, end } = getSarajevoMonthBounds("2026-05-01");
    expect(start).toBe("2026-04-30T22:00:00.000Z");
    expect(end).toBe("2026-05-31T22:00:00.000Z");
  });

  it("input je zadnji dan mjeseca — end je 1. sljedećeg", () => {
    const { start, end } = getSarajevoMonthBounds("2026-05-31");
    expect(start).toBe("2026-04-30T22:00:00.000Z");
    expect(end).toBe("2026-05-31T22:00:00.000Z");
  });

  it("Februar 2028 (prestupna godina, 29 dana)", () => {
    const { start, end } = getSarajevoMonthBounds("2028-02-15");
    // Februar = CET (UTC+1)
    expect(start).toBe("2028-01-31T23:00:00.000Z");
    expect(end).toBe("2028-02-29T23:00:00.000Z");
  });

  it("Decembar → januar prelaz (godina granica)", () => {
    const { start, end } = getSarajevoMonthBounds("2026-12-15");
    // Decembar = CET
    expect(start).toBe("2026-11-30T23:00:00.000Z");
    expect(end).toBe("2026-12-31T23:00:00.000Z");
  });

  it("Mart 2026 (mjesec sa DST proljeće tranzicijom)", () => {
    const { start, end } = getSarajevoMonthBounds("2026-03-15");
    // 1. mart 00:00 CET = 23:00 UTC 28. februara
    expect(start).toBe("2026-02-28T23:00:00.000Z");
    // 1. april 00:00 CEST = 22:00 UTC 31. marta
    expect(end).toBe("2026-03-31T22:00:00.000Z");
  });

  it("Oktobar 2026 (mjesec sa DST jesen tranzicijom)", () => {
    const { start, end } = getSarajevoMonthBounds("2026-10-15");
    // 1. okt 00:00 CEST = 22:00 UTC 30. septembra
    expect(start).toBe("2026-09-30T22:00:00.000Z");
    // 1. nov 00:00 CET = 23:00 UTC 31. oktobra
    expect(end).toBe("2026-10-31T23:00:00.000Z");
  });

  it("baca grešku za neispravan datum", () => {
    expect(() => getSarajevoMonthBounds("not-a-date")).toThrow();
    expect(() => getSarajevoMonthBounds("2026-13-01")).toThrow();
  });
});
```

Update import u test fajlu:

```typescript
import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  getSarajevoMonthBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
```

- [ ] **Step 2.2: Run tests, verify they fail**

```bash
cd up-beauty && npm test -- tests/unit/day-bounds.test.ts
```

Expected: 8 failures u `getSarajevoMonthBounds` describe-u.

- [ ] **Step 2.3: Implement getSarajevoMonthBounds**

Modify `src/lib/utils/day-bounds.ts`. Dodati funkciju **nakon** `getSarajevoWeekBounds`:

```typescript
/**
 * Vraća Sarajevo mjesečne granice (1. dan u mjesecu 00:00 — 1. sljedećeg 00:00)
 * kao ISO UTC stringove. End je exclusive.
 *
 * Input: bilo koji YYYY-MM-DD dateStr unutar tog mjeseca. Ispravno radi za
 * sve dužine mjeseci (28/29/30/31) i decembar→januar prelaz. DST-safe.
 */
export function getSarajevoMonthBounds(dateStr: string): {
  start: string;
  end: string;
} {
  assertIsoDate(dateStr);
  const [y, m] = dateStr.split("-").map(Number);
  // Prvi dan ovog mjeseca, ponoć u Sarajevu
  const start = atSarajevo(y, m, 1, 0, 0);
  // Prvi dan sljedećeg mjeseca: (y, m+1, 1) sa wraparound za decembar
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = atSarajevo(nextY, nextM, 1, 0, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
```

- [ ] **Step 2.4: Run tests, verify they pass**

```bash
cd up-beauty && npm test -- tests/unit/day-bounds.test.ts
```

Expected: svih 8 novih testova PASS. Postojeći (day i week) PASS.

- [ ] **Step 2.5: Commit**

```bash
cd up-beauty && git add src/lib/utils/day-bounds.ts tests/unit/day-bounds.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): add getSarajevoMonthBounds for TZ-aware month filtering

Direktan računa preko atSarajevo(y, m+1, 1) sa wraparound za decembar.
DST-safe jer atSarajevo radi tačnu konverziju kalendarskog dana → epoch.
Pokriva sve dužine mjeseci, prestupne godine, godinu i DST granice.

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md (A)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: computeDefaultSort

**Files:**
- Modify: `src/lib/utils/admin-prefs.ts` (dodati funkciju i tipove na kraju fajla).
- Modify: `tests/unit/admin-prefs.test.ts` (dodati `describe`).

- [ ] **Step 3.1: Write failing tests**

Append na kraj `tests/unit/admin-prefs.test.ts`:

```typescript
describe("computeDefaultSort", () => {
  it("returns 'asc' kad je date setovan (single-day view)", () => {
    expect(computeDefaultSort({ date: "2026-05-19", range: "svi" })).toBe("asc");
  });

  it("returns 'asc' za range='danas' (single-day view)", () => {
    expect(computeDefaultSort({ date: undefined, range: "danas" })).toBe("asc");
  });

  it("returns 'desc' za range='sedmica' (multi-day)", () => {
    expect(computeDefaultSort({ date: undefined, range: "sedmica" })).toBe("desc");
  });

  it("returns 'desc' za range='mjesec' (multi-day)", () => {
    expect(computeDefaultSort({ date: undefined, range: "mjesec" })).toBe("desc");
  });

  it("returns 'desc' za range='svi' (multi-day)", () => {
    expect(computeDefaultSort({ date: undefined, range: "svi" })).toBe("desc");
  });
});
```

Update import u test fajlu:

```typescript
import {
  parseTerminiPrefs,
  serializeTerminiPrefs,
  TERMINI_PREFS_COOKIE,
  DASHBOARD_DATE_COOKIE,
  computeDefaultSort,
  type TerminiPrefs,
} from "@/lib/utils/admin-prefs";
```

- [ ] **Step 3.2: Run tests, verify they fail**

```bash
cd up-beauty && npm test -- tests/unit/admin-prefs.test.ts
```

Expected: 5 failures u `computeDefaultSort` describe-u.

- [ ] **Step 3.3: Implement computeDefaultSort**

Modify `src/lib/utils/admin-prefs.ts`. Dodati na kraj fajla (nakon `parseDashboardDate`):

```typescript
/**
 * Default sort izračun za Termini listu:
 *   - ASC za single-day view (date setovan ili range='danas') — jutarnji prvi.
 *   - DESC za multi-day (sedmica/mjesec/svi) — najnoviji prvi.
 *
 * Izloženo kao posebna funkcija jer i page.tsx i URL builder-i u UI-u trebaju
 * isti izračun (DRY).
 */
export function computeDefaultSort(args: {
  date: string | undefined;
  range: "danas" | "sedmica" | "mjesec" | "svi";
}): "asc" | "desc" {
  const isSingleDay = !!args.date || args.range === "danas";
  return isSingleDay ? "asc" : "desc";
}
```

- [ ] **Step 3.4: Run tests, verify they pass**

```bash
cd up-beauty && npm test -- tests/unit/admin-prefs.test.ts
```

Expected: svih 5 testova PASS.

- [ ] **Step 3.5: Commit**

```bash
cd up-beauty && git add src/lib/utils/admin-prefs.ts tests/unit/admin-prefs.test.ts
git commit -m "$(cat <<'EOF'
feat(admin-prefs): add computeDefaultSort helper

Extrakcija default sort logike iz page.tsx — koristi se i u page render-u
i u URL builder-ima (sortPreserve). DRY zamjena za inline ternar.

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: resolveTerminiPrefs

**Files:**
- Modify: `src/lib/utils/admin-prefs.ts` (dodati `ResolvedTerminiPrefs` tip + `resolveTerminiPrefs`).
- Modify: `tests/unit/admin-prefs.test.ts` (dodati `describe`).

- [ ] **Step 4.1: Write failing tests**

Append na kraj `tests/unit/admin-prefs.test.ts`:

```typescript
describe("resolveTerminiPrefs", () => {
  it("svi defaulti za prazan URL + prazan cookie", () => {
    const result = resolveTerminiPrefs({}, {});
    expect(result).toEqual({
      date: undefined,
      range: "svi",
      status: "svi",
      sort: "desc",
      isDefaultSort: true,
    });
  });

  it("per-param merge — URL status pobjeđuje, range/sort iz cookie-ja (NALAZ D)", () => {
    const result = resolveTerminiPrefs(
      { status: "ceka" },
      { range: "mjesec", sort: "asc" },
    );
    expect(result).toEqual({
      date: undefined,
      range: "mjesec",
      status: "ceka",
      sort: "asc",
      isDefaultSort: false,
    });
  });

  it("URL range pobjeđuje cookie date (odbacuje cookie date)", () => {
    const result = resolveTerminiPrefs(
      { range: "sedmica" },
      { date: "2026-05-19" },
    );
    expect(result.date).toBeUndefined();
    expect(result.range).toBe("sedmica");
    expect(result.sort).toBe("desc"); // default za multi-day
    expect(result.isDefaultSort).toBe(true);
  });

  it("URL date forsira range='svi', sort default ASC (single-day)", () => {
    const result = resolveTerminiPrefs({ date: "2026-05-19" }, {});
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
    expect(result.sort).toBe("asc");
    expect(result.isDefaultSort).toBe(true);
  });

  it("URL ima i date i range — date pobjeđuje, range='svi'", () => {
    const result = resolveTerminiPrefs(
      { date: "2026-05-19", range: "mjesec" },
      {},
    );
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
  });

  it("Cookie ima i date i range — date pobjeđuje (URL prazan)", () => {
    const result = resolveTerminiPrefs(
      {},
      { date: "2026-05-19", range: "mjesec" },
    );
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
  });

  it("URL status=ceka + cookie {date, range} — date iz cookie-a se zadržava, range='svi'", () => {
    const result = resolveTerminiPrefs(
      { status: "ceka" },
      { date: "2026-05-19", range: "mjesec" },
    );
    expect(result.date).toBe("2026-05-19");
    expect(result.range).toBe("svi");
    expect(result.status).toBe("ceka");
  });

  it("Invalid date u URL-u → ignoriše se, pada na cookie", () => {
    const result = resolveTerminiPrefs(
      { date: "garbage" },
      { date: "2026-05-19" },
    );
    expect(result.date).toBe("2026-05-19");
  });

  it("Invalid range u URL-u → ignoriše se, pada na cookie/default", () => {
    const result = resolveTerminiPrefs(
      { range: "ICANT" },
      { range: "sedmica" },
    );
    expect(result.range).toBe("sedmica");
  });

  it("Invalid status u URL-u → ignoriše se", () => {
    const result = resolveTerminiPrefs({ status: "BOGUS" }, {});
    expect(result.status).toBe("svi");
  });

  it("Invalid sort u URL-u → ignoriše se, isDefaultSort=true", () => {
    const result = resolveTerminiPrefs({ sort: "foobar" }, {});
    expect(result.sort).toBe("desc");
    expect(result.isDefaultSort).toBe(true);
  });

  it("Explicit sort u cookie-u — isDefaultSort=false", () => {
    const result = resolveTerminiPrefs({}, { sort: "asc" });
    expect(result.sort).toBe("asc");
    expect(result.isDefaultSort).toBe(false);
  });
});
```

Update import u test fajlu:

```typescript
import {
  parseTerminiPrefs,
  serializeTerminiPrefs,
  TERMINI_PREFS_COOKIE,
  DASHBOARD_DATE_COOKIE,
  computeDefaultSort,
  resolveTerminiPrefs,
  type TerminiPrefs,
  type ResolvedTerminiPrefs,
} from "@/lib/utils/admin-prefs";
```

- [ ] **Step 4.2: Run tests, verify they fail**

```bash
cd up-beauty && npm test -- tests/unit/admin-prefs.test.ts
```

Expected: 12 failures u `resolveTerminiPrefs` describe-u.

- [ ] **Step 4.3: Implement resolveTerminiPrefs and ResolvedTerminiPrefs**

Modify `src/lib/utils/admin-prefs.ts`. Dodati na kraj fajla (nakon `computeDefaultSort`):

```typescript
export type ResolvedTerminiPrefs = {
  date: string | undefined;
  range: "danas" | "sedmica" | "mjesec" | "svi";
  status: "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";
  sort: "asc" | "desc";
  /**
   * True ako sort nije eksplicit od user-a (ni URL ni cookie) i izveden je
   * iz date/range. URL builder-i u page.tsx koriste ovo da ne dodaju ?sort=
   * u URL kad je default (čistiji URL).
   */
  isDefaultSort: boolean;
};

/**
 * Resolve URL params + cookie u finalne, normalizovane Termini prefs.
 *
 * Per-param merge: missing URL params fallback na cookie value.
 *
 * Date/range međusobno isključivost (deterministički 4 koraka):
 *   1. date: ako URL ima range → date = urlDate (cookie date se odbacuje)
 *            inače → date = urlDate ?? cookieDate
 *   2. range: ako date postoji → range = "svi" (date pobjeđuje range)
 *             inače → range = urlRange ?? cookieRange ?? "svi"
 *   3. status: urlStatus ?? cookieStatus ?? "svi"
 *   4. sort: explicit = urlSort ?? cookieSort, sort = explicit ?? defaultSort,
 *           isDefaultSort = explicit === undefined
 */
export function resolveTerminiPrefs(
  urlParams: {
    date?: string;
    range?: string;
    status?: string;
    sort?: string;
  },
  cookiePrefs: TerminiPrefs,
): ResolvedTerminiPrefs {
  const urlDate = isValidDate(urlParams.date) ? urlParams.date : undefined;
  const urlRange = isValidRange(urlParams.range)
    ? urlParams.range
    : undefined;
  const urlStatus = isValidStatus(urlParams.status)
    ? urlParams.status
    : undefined;
  const urlSort = isValidSort(urlParams.sort) ? urlParams.sort : undefined;

  // Korak 1: date
  const date = urlRange ? urlDate : (urlDate ?? cookiePrefs.date);

  // Korak 2: range
  const range: ResolvedTerminiPrefs["range"] = date
    ? "svi"
    : (urlRange ?? cookiePrefs.range ?? "svi");

  // Korak 3: status
  const status: ResolvedTerminiPrefs["status"] =
    urlStatus ?? cookiePrefs.status ?? "svi";

  // Korak 4: sort
  const defaultSort = computeDefaultSort({ date, range });
  const explicit = urlSort ?? cookiePrefs.sort;
  const sort = explicit ?? defaultSort;
  const isDefaultSort = explicit === undefined;

  return { date, range, status, sort, isDefaultSort };
}
```

- [ ] **Step 4.4: Run tests, verify they pass**

```bash
cd up-beauty && npm test -- tests/unit/admin-prefs.test.ts
```

Expected: svih 12 testova `resolveTerminiPrefs` PASS. Postojeći testovi PASS.

- [ ] **Step 4.5: Commit**

```bash
cd up-beauty && git add src/lib/utils/admin-prefs.ts tests/unit/admin-prefs.test.ts
git commit -m "$(cat <<'EOF'
feat(admin-prefs): add resolveTerminiPrefs with per-param URL+cookie merge

Fixira nalaz D iz spec-a: cookie fallback više nije sve-ili-ništa.
Klik na status chip iz home stranice sad čuva range/sort iz prethodne
sesije (per-param merge umjesto atomic state).

Deterministički 4-koraka algoritam rješava date/range konflikt:
URL range pobjeđuje cookie date; date uvijek pobjeđuje range.

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md (D)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: buildAppointmentsBoundsFilter

**Files:**
- Create: `src/lib/utils/termini-filters.ts`
- Create: `tests/unit/termini-filters.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `tests/unit/termini-filters.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildAppointmentsBoundsFilter } from "@/lib/utils/termini-filters";
import { getSarajevoDayBounds, sarajevoTodayDateStr } from "@/lib/utils/day-bounds";

describe("buildAppointmentsBoundsFilter", () => {
  it("date setovan → koristi getSarajevoDayBounds, range se ignoriše", () => {
    const result = buildAppointmentsBoundsFilter({
      date: "2026-05-19",
      range: "mjesec",
    });
    const expected = getSarajevoDayBounds("2026-05-19");
    expect(result).toEqual({
      kind: "bounded",
      gte: expected.start,
      lt: expected.end,
    });
  });

  it("range='svi' → unbounded", () => {
    const result = buildAppointmentsBoundsFilter({
      date: undefined,
      range: "svi",
    });
    expect(result).toEqual({ kind: "unbounded" });
  });

  it("range='danas' u 23:30 Sarajevo daje iste bounds kao ?date=<today> (REGRESSION NALAZ A)", () => {
    // 23:30 Sarajevo zima = 22:30 UTC isti dan
    const nowLateNight = new Date("2026-01-15T22:30:00.000Z");
    const today = sarajevoTodayDateStr(nowLateNight);

    const rangeResult = buildAppointmentsBoundsFilter(
      { date: undefined, range: "danas" },
      nowLateNight,
    );
    const dateResult = buildAppointmentsBoundsFilter(
      { date: today, range: "svi" },
      nowLateNight,
    );
    expect(rangeResult).toEqual(dateResult);
  });

  it("range='danas' u ranojutarnjem 00:30 Sarajevo (UTC prethodni dan) — koristi Sarajevo today", () => {
    // 00:30 Sarajevo zima = 23:30 UTC prethodni dan
    const nowEarlyMorning = new Date("2026-01-15T23:30:00.000Z");
    const today = sarajevoTodayDateStr(nowEarlyMorning); // 2026-01-16

    const result = buildAppointmentsBoundsFilter(
      { date: undefined, range: "danas" },
      nowEarlyMorning,
    );
    const expected = getSarajevoDayBounds(today);
    expect(result).toEqual({
      kind: "bounded",
      gte: expected.start,
      lt: expected.end,
    });
  });

  it("range='sedmica' koristi getSarajevoWeekBounds(today)", () => {
    // 2026-05-20 srijeda u 14:00 Sarajevo CEST = 12:00 UTC
    const wedNoon = new Date("2026-05-20T12:00:00.000Z");
    const result = buildAppointmentsBoundsFilter(
      { date: undefined, range: "sedmica" },
      wedNoon,
    );
    // Sedmica = pon 18. maj → pon 25. maj
    expect(result).toEqual({
      kind: "bounded",
      gte: "2026-05-17T22:00:00.000Z",
      lt: "2026-05-24T22:00:00.000Z",
    });
  });

  it("range='mjesec' koristi getSarajevoMonthBounds(today)", () => {
    // 2026-05-15
    const may15Noon = new Date("2026-05-15T12:00:00.000Z");
    const result = buildAppointmentsBoundsFilter(
      { date: undefined, range: "mjesec" },
      may15Noon,
    );
    expect(result).toEqual({
      kind: "bounded",
      gte: "2026-04-30T22:00:00.000Z",
      lt: "2026-05-31T22:00:00.000Z",
    });
  });
});
```

- [ ] **Step 5.2: Run tests, verify they fail**

```bash
cd up-beauty && npm test -- tests/unit/termini-filters.test.ts
```

Expected: 6 failures sa "Cannot find module '@/lib/utils/termini-filters'".

- [ ] **Step 5.3: Implement buildAppointmentsBoundsFilter**

Create `src/lib/utils/termini-filters.ts`:

```typescript
import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  getSarajevoMonthBounds,
  sarajevoTodayDateStr,
} from "@/lib/utils/day-bounds";
import type { ResolvedTerminiPrefs } from "@/lib/utils/admin-prefs";

export type AppointmentsBoundsFilter =
  | { kind: "bounded"; gte: string; lt: string }
  | { kind: "unbounded" };

/**
 * Prevodi resolved Termini prefs u Supabase query bounds. Single source of
 * truth — koristi se za sve query-je u page.tsx (appointments, counts, total).
 *
 * Garancija: svaka opcija (date, range=danas/sedmica/mjesec/svi) koristi
 * Sarajevo TZ. Server TZ (UTC na Vercel-u) ne curi u rezultat.
 *
 * `now` parametar omogućava deterministički unit test (fiksni datum). U
 * produkciji se ne prosljeđuje — default je trenutni moment.
 *
 * Bounds semantika: end je exclusive (`gte/lt` pattern u DB query-ju).
 */
export function buildAppointmentsBoundsFilter(
  resolved: Pick<ResolvedTerminiPrefs, "date" | "range">,
  now: Date = new Date(),
): AppointmentsBoundsFilter {
  if (resolved.date) {
    const b = getSarajevoDayBounds(resolved.date);
    return { kind: "bounded", gte: b.start, lt: b.end };
  }
  const todayStr = sarajevoTodayDateStr(now);
  switch (resolved.range) {
    case "danas": {
      const b = getSarajevoDayBounds(todayStr);
      return { kind: "bounded", gte: b.start, lt: b.end };
    }
    case "sedmica": {
      const b = getSarajevoWeekBounds(todayStr);
      return { kind: "bounded", gte: b.start, lt: b.end };
    }
    case "mjesec": {
      const b = getSarajevoMonthBounds(todayStr);
      return { kind: "bounded", gte: b.start, lt: b.end };
    }
    case "svi":
      return { kind: "unbounded" };
  }
}
```

- [ ] **Step 5.4: Run tests, verify they pass**

```bash
cd up-beauty && npm test -- tests/unit/termini-filters.test.ts
```

Expected: svih 6 testova PASS.

- [ ] **Step 5.5: Run full unit suite to verify no regressions**

```bash
cd up-beauty && npm test
```

Expected: svi unit testovi (uključujući postojeće) PASS.

- [ ] **Step 5.6: Commit**

```bash
cd up-beauty && git add src/lib/utils/termini-filters.ts tests/unit/termini-filters.test.ts
git commit -m "$(cat <<'EOF'
feat(termini): add buildAppointmentsBoundsFilter (TZ-aware single source)

Single source of truth za prevod resolved prefs → DB query bounds.
Sve grane koriste Sarajevo TZ helpere — eliminiše bug gdje su
range=danas/sedmica/mjesec koristili server TZ umjesto Sarajevo TZ.

Fixira nalaz A i B iz spec-a: range='danas' i ?date=<today> sad daju
identičan rezultat za sve sate u danu (uključujući 00:30 i 23:30
Sarajevo lokalno).

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md (A, B)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Refaktor page.tsx — TZ + cookie merge

**Files:**
- Modify: `src/app/admin/(protected)/termini/page.tsx`

Ovo je veći task — prepiše većinu page.tsx-a. Ne dijelimo na pod-step-ove sa testovima jer page.tsx nije unit-testabilan (server komponenta). Verifikacija ide kroz tipovi + lint + e2e u Task 7.

- [ ] **Step 6.1: Rewrite page.tsx**

Replace cijeli sadržaj `src/app/admin/(protected)/termini/page.tsx`:

```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppointmentsRealtime } from "@/components/admin/AppointmentsRealtime";
import { AdminPrefsPersister } from "@/components/admin/AdminPrefsPersister";
import {
  TERMINI_PREFS_COOKIE,
  parseTerminiPrefs,
  resolveTerminiPrefs,
  computeDefaultSort,
} from "@/lib/utils/admin-prefs";
import { PageHeader } from "@/components/admin/PageHeader";
import { AppointmentRow } from "@/components/admin/AppointmentRow";
import { TerminiToolbar } from "@/components/admin/TerminiToolbar";
import { AdminDayPicker } from "@/components/admin/AdminDayPicker";
import { TerminiSortToggle } from "@/components/admin/TerminiSortToggle";
import { TerminiStatusFilter } from "@/components/admin/TerminiStatusFilter";
import { countByStatus } from "@/lib/utils/status-counts";
import {
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
import { buildAppointmentsBoundsFilter } from "@/lib/utils/termini-filters";
import { parseBookingSettings } from "@/lib/settings/read";
import { groupAppointmentsByDay } from "@/lib/utils/group-by-day";
import { formatDate } from "@/lib/utils/format";
import { parseDateSarajevo } from "@/lib/utils/tz";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Termini — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const APPOINTMENTS_LIMIT = 500;

type Range = "danas" | "sedmica" | "mjesec" | "svi";
type StatusFilter = "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";

const RANGE_LABELS: Record<Range, string> = {
  danas: "Danas",
  sedmica: "Sedmica",
  mjesec: "Mjesec",
  svi: "Svi",
};

export default async function AdminTerminiPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    status?: string;
    date?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookiePrefs = parseTerminiPrefs(
    cookieStore.get(TERMINI_PREFS_COOKIE)?.value,
  );

  const resolved = resolveTerminiPrefs(params, cookiePrefs);
  const bounds = buildAppointmentsBoundsFilter(resolved);

  const sb = await createClient();
  const now = new Date();
  const todayStr = sarajevoTodayDateStr(now);

  // maxDateStr za day picker
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
  const maxDateStr = addDaysToDateStr(
    todayStr,
    bookingSettings.advanceBookingDays,
  );

  // Bounds builder — primjenjuje gte/lt ako su definisani
  const applyBounds = <T,>(
    q: T & {
      gte: (col: string, val: string) => T;
      lt: (col: string, val: string) => T;
    },
  ): T => {
    if (bounds.kind === "bounded") {
      return q.gte("start_time", bounds.gte).lt("start_time", bounds.lt);
    }
    return q;
  };

  // Appointments query (sortiran, limit)
  let appointmentsQuery = applyBounds(
    sb
      .from("appointments")
      .select(
        "id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)",
      )
      .order("start_time", { ascending: resolved.sort === "asc" })
      .limit(APPOINTMENTS_LIMIT),
  );
  if (resolved.status !== "svi") {
    appointmentsQuery = appointmentsQuery.eq("status", resolved.status);
  }

  // Counts query — bez status filtera (dropdown pokazuje sve statuse)
  const countsQuery = applyBounds(sb.from("appointments").select("status"));

  // Total count query — head: true (brz, samo count)
  let totalCountQuery = applyBounds(
    sb.from("appointments").select("id", { count: "exact", head: true }),
  );
  if (resolved.status !== "svi") {
    totalCountQuery = totalCountQuery.eq("status", resolved.status);
  }

  const [
    { data: appointments },
    { data: servicesData },
    { data: countsData },
    { count: totalMatching },
  ] = await Promise.all([
    appointmentsQuery,
    sb
      .from("services")
      .select("*")
      .eq("bookable", true)
      .eq("active", true)
      .order("order_index"),
    countsQuery,
    totalCountQuery,
  ]);
  const services = servicesData ?? [];
  const statusCounts = countByStatus(countsData ?? []);

  const groups = groupAppointmentsByDay(appointments ?? []);
  const multiDay = groups.length > 1;

  // URL helpers — koriste resolved.* (uključuje cookie fallback)
  const defaultSort = computeDefaultSort({
    date: resolved.date,
    range: resolved.range,
  });

  const buildPresetHref = (r: Range, s: StatusFilter): string => {
    const sp = new URLSearchParams();
    sp.set("range", r);
    if (s !== "svi") sp.set("status", s);
    if (resolved.sort !== defaultSort) sp.set("sort", resolved.sort);
    return `/admin/termini?${sp.toString()}`;
  };

  const dayPickerPreserve: Record<string, string | undefined> = {
    status: resolved.status !== "svi" ? resolved.status : undefined,
    sort: resolved.sort !== defaultSort ? resolved.sort : undefined,
  };

  const sortPreserve: Record<string, string | undefined> = {
    range: resolved.date
      ? undefined
      : resolved.range !== "svi"
        ? resolved.range
        : undefined,
    date: resolved.date,
    status: resolved.status !== "svi" ? resolved.status : undefined,
  };

  const statusPreserve: Record<string, string | undefined> = {
    range: resolved.date
      ? undefined
      : resolved.range !== "svi"
        ? resolved.range
        : undefined,
    date: resolved.date,
    sort: resolved.sort !== defaultSort ? resolved.sort : undefined,
  };

  return (
    <div>
      <AppointmentsRealtime />
      <AdminPrefsPersister />
      <PageHeader
        title="Termini"
        subtitle={`${appointments?.length ?? 0} zabilježenih`}
        action={<TerminiToolbar services={services} />}
      />

      <div className="p-5 md:p-8">
        <div className="mb-4 border border-cream bg-white p-3">
          <AdminDayPicker
            selectedDateStr={resolved.date ?? todayStr}
            todayDateStr={todayStr}
            maxDateStr={maxDateStr}
            basePath="/admin/termini"
            preserveParams={dayPickerPreserve}
          />
        </div>

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1.5 overflow-x-auto">
            {(["danas", "sedmica", "mjesec", "svi"] as const).map((r) => (
              <FilterLink
                key={r}
                href={buildPresetHref(r, resolved.status)}
                active={!resolved.date && resolved.range === r}
                label={RANGE_LABELS[r]}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <TerminiStatusFilter
              value={resolved.status}
              counts={statusCounts}
              basePath="/admin/termini"
              preserveParams={statusPreserve}
            />
            <TerminiSortToggle
              sort={resolved.sort}
              basePath="/admin/termini"
              preserveParams={sortPreserve}
            />
          </div>
        </div>

        {(appointments?.length ?? 0) === 0 ? (
          <div className="border border-cream bg-white p-10 text-center">
            <p className="text-sm text-light">
              Nema termina za izabrani filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.dateStr}>
                {multiDay && <DateGroupHeader dateStr={group.dateStr} />}
                <div className="overflow-hidden border border-cream">
                  {group.appointments.map((appt) => (
                    <AppointmentRow
                      key={appt.id}
                      appointment={{
                        ...appt,
                        status: appt.status as
                          | "ceka"
                          | "potvrdjen"
                          | "otkazan"
                          | "zavrsen",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalMatching !== null &&
          totalMatching > APPOINTMENTS_LIMIT && (
            <p className="mt-4 border border-cream bg-white p-3 text-center text-xs text-light">
              Prikazano {APPOINTMENTS_LIMIT} od {totalMatching} termina.
              Suzite filter za prikaz preostalih.
            </p>
          )}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap border px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "border-rose bg-rose text-white"
          : "border-cream bg-white text-body hover:border-rose hover:text-rose",
      )}
    >
      {label}
    </Link>
  );
}

function DateGroupHeader({ dateStr }: { dateStr: string }) {
  return (
    <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-light first-letter:uppercase">
      {formatDate(parseDateSarajevo(dateStr))}
    </p>
  );
}
```

- [ ] **Step 6.2: Verify type errors / linting**

```bash
cd up-beauty && npm run typecheck
```

Expected: bez grešaka. Ako se desi problem sa generic-om `applyBounds`, alternativna implementacija:

```typescript
// Alternativa ako TypeScript ne može da resolve-uje generic: koristi inline,
// jer query builder vraća chained tip koji TS strict mode teško prati.
// U tom slučaju, ponovi gte/lt inline za svaki query (DRY se gubi, ali
// type safety dobija).
```

Ako prvi pristup ne prolazi typecheck, primijeniti inline alternativu:

```typescript
// Inline alternativa — ponoviti gte/lt po query-ju
let appointmentsQuery = sb
  .from("appointments")
  .select("id,client_name,...")
  .order("start_time", { ascending: resolved.sort === "asc" })
  .limit(APPOINTMENTS_LIMIT);
if (bounds.kind === "bounded") {
  appointmentsQuery = appointmentsQuery
    .gte("start_time", bounds.gte)
    .lt("start_time", bounds.lt);
}
if (resolved.status !== "svi") {
  appointmentsQuery = appointmentsQuery.eq("status", resolved.status);
}
// (isto za countsQuery i totalCountQuery)
```

- [ ] **Step 6.3: Verify lint**

```bash
cd up-beauty && npm run lint
```

Expected: bez warning-a/errors. Ako ESLint javi unused import `cn` (ako je slučajno izbrisan), provjeriti da `FilterLink` i dalje koristi.

- [ ] **Step 6.4: Verify unit tests pass**

```bash
cd up-beauty && npm test
```

Expected: svih unit testovi PASS (uključujući postojeće — ne smjelo se ništa pokvariti).

- [ ] **Step 6.5: Commit**

```bash
cd up-beauty && git add src/app/admin/\(protected\)/termini/page.tsx
git commit -m "$(cat <<'EOF'
fix(termini): TZ-aware range filters + per-param cookie merge + pagination

- Range=danas/sedmica/mjesec sad koriste Sarajevo TZ bounds (fixira nalaz A)
- Konzistentna gte/lt bounds semantika svuda (nalaz B)
- Hard cap 500 termina + indikator ispod liste (nalaz C)
- Per-param URL+cookie merge — klik na status chip čuva range/sort (nalaz D)
- Modular refactor: resolve i bounds logika izvan komponente

Page.tsx svedeno sa 316 → ~210 linija. Sva poslovna logika u testabilnim
helperima (resolveTerminiPrefs, buildAppointmentsBoundsFilter).

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: E2E regression test

**Files:**
- Create: `tests/e2e/admin-termini-tz.spec.ts`

- [ ] **Step 7.1: Create e2e test fajl**

Create `tests/e2e/admin-termini-tz.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { sarajevoTodayDateStr, getSarajevoDayBounds } from "@/lib/utils/day-bounds";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("admin Termini — TZ regression (NALAZ A)", () => {
  test.skip(!serviceKey, "E2E_SUPABASE_SERVICE_ROLE_KEY nije setovan");

  let createdId: number;
  let todayStr: string;
  const clientName = "E2E_TZ_REGRESSION";

  test.beforeAll(async () => {
    todayStr = sarajevoTodayDateStr();
    // Termin u 00:30 Sarajevo today — rana jutarnja granica koja bi
    // prethodno bila propuštena pod range=danas zbog server TZ bug-a.
    const dayBounds = getSarajevoDayBounds(todayStr);
    const startMs = new Date(dayBounds.start).getTime() + 30 * 60 * 1000;
    const start = new Date(startMs);
    const end = new Date(startMs + 60 * 60 * 1000);

    const admin = createClient(url, serviceKey!);
    // Service ID 1 = Šminkanje 60min (vidi tests/e2e/dashboard-day-navigator.spec.ts:33)
    const { data, error } = await admin
      .from("appointments")
      .insert({
        service_id: 1,
        client_name: clientName,
        client_phone: "+38765999111",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "potvrdjen",
        confirmation_token: crypto.randomUUID(),
      })
      .select("id")
      .single();
    if (error) throw error;
    createdId = data.id;
  });

  test.afterAll(async () => {
    if (!createdId || !serviceKey) return;
    const admin = createClient(url, serviceKey);
    await admin.from("appointments").delete().eq("id", createdId);
  });

  async function login(page: Page) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  }

  test("termin u 00:30 Sarajevo vidljiv je pod ?range=danas", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/admin/termini?range=danas");
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test("isti termin vidljiv je pod ?date=<today>", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/termini?date=${todayStr}`);
    await expect(page.getByText(clientName)).toBeVisible();
  });

  test("count termina jednak je između range=danas i date=<today> (konzistencija)", async ({
    page,
  }) => {
    await login(page);

    await page.goto("/admin/termini?range=danas");
    const rangeCount = await page.getByText(clientName).count();

    await page.goto(`/admin/termini?date=${todayStr}`);
    const dateCount = await page.getByText(clientName).count();

    expect(rangeCount).toBe(dateCount);
    expect(rangeCount).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 7.2: Provjeri da global-setup cleanup pokriva prefix**

Read `tests/e2e/global-setup.ts` (već provjeren — briše `like.E2E*`, što pokriva `E2E_TZ_REGRESSION`).

- [ ] **Step 7.3: Run e2e test lokalno**

Prije pokretanja, **provjeri da Docker Supabase i .env.test postoje**:

```bash
cd up-beauty && ls .env.test && docker ps | grep supabase
```

Ako Docker nije pokrenut:

```bash
cd up-beauty && npm run test:setup
```

Pokreni samo novi spec:

```bash
cd up-beauty && npx playwright test tests/e2e/admin-termini-tz.spec.ts --reporter=list
```

Expected: 3 testa PASS. Ako fail u beforeAll sa "service_id 1 does not exist", proširi setup da prvo upsert-uje service ID 1 (Šminkanje, 60min, bookable=true, active=true).

- [ ] **Step 7.4: Commit**

```bash
cd up-beauty && git add tests/e2e/admin-termini-tz.spec.ts
git commit -m "$(cat <<'EOF'
test(termini): e2e TZ regression for early-morning appointments

Seeduje termin u 00:30 Sarajevo today (granični case koji bi prije
fix-a bio propušten pod range=danas zbog server TZ bug-a) i provjerava:
- Vidljiv pod ?range=danas
- Vidljiv pod ?date=<today>
- Count se poklapa između dva načina (regresija konzistencije)

Refs: docs/superpowers/specs/2026-05-19-termini-tz-filters-design.md (A)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final validation

- [ ] **Step 8.1: Run full validation suite**

```bash
cd up-beauty && npm run typecheck && npm run lint && npm test
```

Expected: 0 errors u typecheck, 0 errors u lint, svi unit testovi PASS (postojeći + ~30 novih).

- [ ] **Step 8.2: Run e2e suite (opciono ali preporučeno)**

```bash
cd up-beauty && npm run test:e2e:local
```

Expected: svi e2e testovi PASS, uključujući novi `admin-termini-tz.spec.ts`.

- [ ] **Step 8.3: Manual smoke test (opciono)**

```bash
cd up-beauty && npm run dev
```

Otvori `http://localhost:3000/admin/termini` u browser-u:
- Klik na "Danas" chip — vidi termine današnjeg dana.
- Klik na "Sedmica" — vidi termine ove sedmice.
- Klik na "Mjesec" — vidi termine ovog mjeseca.
- Klik na status chip "Čeka" — provjeri da range i sort ostaju isti (cookie merge fix nalaza D).
- Otvori `/admin/termini?range=svi` — ako baza ima >500 termina, indikator ispod liste se pojavljuje.

- [ ] **Step 8.4: Branch push (opciono, ako želiš PR)**

```bash
cd up-beauty && git push -u origin fix/termini-tz-filters
```

Onda kreiraj PR ručno preko GitHub UI-a ili `gh pr create` (treba potvrda od user-a prije push-a).

---

## Self-Review

**Spec coverage check:**

| Spec section | Task | OK? |
|---|---|---|
| Goals — TZ-aware range filteri | T5 (bounds filter koristi nove helpere) | ✓ |
| Goals — gte/lt konzistencija | T5 (svuda exclusive end) | ✓ |
| Goals — Hard cap + indikator | T6 (APPOINTMENTS_LIMIT + totalCountQuery + UI) | ✓ |
| Goals — Per-param cookie merge | T4 (resolveTerminiPrefs) | ✓ |
| Goals — Smanjenje page.tsx | T6 (refaktor) | ✓ |
| API — getSarajevoWeekBounds | T1 | ✓ |
| API — getSarajevoMonthBounds | T2 | ✓ |
| API — ResolvedTerminiPrefs, resolveTerminiPrefs | T4 | ✓ |
| API — computeDefaultSort | T3 | ✓ |
| API — buildAppointmentsBoundsFilter | T5 | ✓ |
| Tests — unit (helperi + cookie) | T1, T2, T3, T4, T5 | ✓ |
| Tests — e2e regression | T7 | ✓ |
| Risks — TZ math greška | T1, T2 imaju DST/godine/prestupne testove | ✓ |
| Risks — page.tsx regresija | T6 preservira render semantiku, T7 e2e | ✓ |

**Placeholder scan:** Nema TBD, TODO, "add error handling", ili "similar to Task N" bez ponovljenog koda. Svi koraci imaju konkretne kod blokove.

**Type consistency:** `ResolvedTerminiPrefs` definisan u T4 koristi se sa istim imenima property-ja u T5 (`Pick<ResolvedTerminiPrefs, "date" | "range">`) i T6 (`resolved.date`, `resolved.range`, `resolved.status`, `resolved.sort`, `resolved.isDefaultSort`). `AppointmentsBoundsFilter` definisan u T5 koristi se u T6 sa istim discriminant-om (`bounds.kind === "bounded"`).

`getSarajevoWeekBounds` i `getSarajevoMonthBounds` imaju isti potpis kao `getSarajevoDayBounds` (`(dateStr: string) => {start, end}`) — konzistentno.

**Edge case provjera:**
- DST proljeće (mart 2026) — pokriveno u T1, T2.
- DST jesen (oktobar 2026) — pokriveno u T1, T2.
- Prestupna godina (februar 2028) — pokriveno u T2.
- Godina granica (decembar→januar) — pokriveno u T1, T2.
- Mid-week, ponedjeljak, nedjelja kao input — pokriveno u T1.
- Invalid date strings — pokriveno u T1, T2, T4.

Plan je kompletan i samodovoljan. Engineer može da prati task-po-task bez dodatnog konteksta.
