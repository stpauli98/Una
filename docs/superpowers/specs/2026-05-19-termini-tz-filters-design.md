# Termini — TZ-aware filteri, paginacija, cookie merge — Design

**Status:** Draft (awaiting user review)
**Date:** 2026-05-19
**Author:** Nikola Milošević + Claude Opus 4.7

## Problem

`src/app/admin/(protected)/termini/page.tsx` ima 4 problema u logici filtriranja, sortiranja i prikaza termina:

**A. Range filteri nisu TZ-aware (najveći).**
`?date=<dateStr>` koristi `getSarajevoDayBounds` koji ispravno računa Sarajevo ponoć→ponoć granice. Ali `?range=danas|sedmica|mjesec` koriste `startOfDay(now)`, `startOfWeek(now, {weekStartsOn:1})`, `startOfMonth(now)` iz `date-fns`, što radi u **server lokalnoj TZ**. Na Vercel-u server je UTC. Posljedice:

- U 23:30 Sarajevo zima (UTC+1), `startOfDay(now)` daje 00:00 UTC = 01:00 Sarajevo. Termin u 00:30 Sarajevo (= 23:30 UTC prethodni dan) **ispada** iz `?range=danas`.
- Isti termin u 00:30 Sarajevo **bi se vidio** pod `?date=<today>` jer taj path koristi TZ-aware bounds.
- `range=danas` i `?date=<today>` daju različit skup termina za isti dan — neprihvatljivo.
- Sedmica i mjesec imaju iste 1-2h pomake na svojim granicama.

**B. Inkonzistentna bounds semantika (`gte/lt` vs `gte/lte`).**
`?date` koristi exclusive end (`lt`), `range=*` koristi inclusive end (`lte`). Sitno odstupanje za termine tačno na granici dana.

**C. Bez paginacije za `range=svi`.**
Supabase ima default cap 1000 redova. Sa rastom baze, `svi` može tiho odbaciti dio termina bez indikatora.

**D. Cookie fallback je sve-ili-ništa.**
Ako URL ima **bilo koji** filter param, cookie se ignoriše u **potpunosti** i preostali params padaju na default. Klik na status chip iz home stranice resetuje range i sort, što je neintuitivno.

## Goals

- `range=danas|sedmica|mjesec` daju Sarajevo TZ granice, identične sa `?date=<today>`.
- Standardizovati bounds semantiku — svuda `gte` + exclusive `lt`.
- Hard cap (500) za `range=svi` (i druge bezgranične upite) sa diskretnim UI indikatorom kad postoji odbačeno.
- Cookie merge per-param: missing URL params se popunjavaju iz cookie-ja.
- Smanjiti `page.tsx` izdvajanjem testabilne logike u helpere.

## Non-goals

- Promjena UI/UX layout-a, dugmadi ili izgleda.
- Klasična paginacija sa "Učitaj još".
- Refaktor URL builder-a (`buildPresetHref`, `dayPickerPreserve` itd.) — ostaju u page.tsx.
- Promjena realtime logike (`AppointmentsRealtime.tsx`).
- Migracija na drugu TZ biblioteku.

## Architecture

```
src/lib/utils/
├── day-bounds.ts              [EDIT] + getSarajevoWeekBounds, getSarajevoMonthBounds
├── admin-prefs.ts             [EDIT] + resolveTerminiPrefs, + computeDefaultSort, + ResolvedTerminiPrefs
└── termini-filters.ts         [NEW]  buildAppointmentsBoundsFilter

src/app/admin/(protected)/termini/
└── page.tsx                   [EDIT] koristi 3 helpera, .limit(500), indikator komponenta

tests/unit/
├── day-bounds.test.ts         [NEW]  week/month bounds + DST tranzicije
├── admin-prefs.test.ts        [NEW]  resolveTerminiPrefs merge cases
└── termini-filters.test.ts    [NEW]  bounds filter kombinacije

tests/e2e/
└── admin-termini-tz.spec.ts   [NEW]  jutarnji termin 00:30 Sarajevo vidljiv pod 'Danas'
```

**Granice odgovornosti:**

- `day-bounds.ts` — čisto TZ math, ne zna ništa o adminu.
- `admin-prefs.ts` — čisto cookie/URL merge i default resolve, ne zna ništa o Supabase.
- `termini-filters.ts` — prevod `resolved prefs → DB bounds`, ne zna ništa o cookies/URL.
- `page.tsx` — orchestrator: `cookies → resolve → bounds → query → render`.

Svaki modul testabilan izolovano.

## API specifikacija

### `src/lib/utils/day-bounds.ts` (proširenje)

```typescript
/**
 * Sarajevo sedmične granice (ponedjeljak 00:00 — sljedeći ponedjeljak 00:00) kao
 * ISO UTC stringovi. End je exclusive (koristi `gte/lt` u DB query-ju).
 *
 * Input: bilo koji YYYY-MM-DD dateStr unutar te sedmice. Funkcija sama nađe
 * ponedjeljak. DST-safe (sva aritmetika ide preko podneva kao bazne tačke).
 *
 * Throws: ako dateStr nije validan kalendarski datum.
 */
export function getSarajevoWeekBounds(dateStr: string): {
  start: string;
  end: string;
};

/**
 * Sarajevo mjesečne granice (1. dan u mjesecu 00:00 — 1. sljedećeg 00:00) kao
 * ISO UTC stringovi. End je exclusive.
 *
 * Input: bilo koji YYYY-MM-DD dateStr unutar tog mjeseca. Ispravno radi za
 * sve dužine mjeseci (28/29/30/31 dana) i decembar→januar prelaz.
 *
 * Throws: ako dateStr nije validan kalendarski datum.
 */
export function getSarajevoMonthBounds(dateStr: string): {
  start: string;
  end: string;
};
```

**Implementacijska strategija:**

Obje funkcije slijede isti pattern kao postojeća `getSarajevoDayBounds`:

1. Validiraj `dateStr` preko `assertIsoDate`.
2. Za `week`: nađi ponedjeljak — `formatInTimeZone(parseDateSarajevo(dateStr), TZ, "i")` daje ISO dan (1=Mon, 7=Sun). Oduzmi `(dayOfWeek-1) * 24h` od **podneva** tog dana (podne kao baza je DST-safe). Onda format → ponoć tog ponedjeljka.
3. End granica week = start + 7 dana, ponovo preko podneva → format → ponoć.
4. Za `month`: `monthStartDateStr = formatInTimeZone(input, TZ, "yyyy-MM-01")`. Start = ponoć tog dana. End = `addDaysToDateStr(monthStartDateStr, 32)` pa onda format na `"yyyy-MM-01"` opet (sigurno nađe 1. sljedećeg mjeseca jer nijedan mjesec nema >31 dan).

**DST sigurnost:** Sva `+/-24h` aritmetika ide kroz podne (12:00 lokalno), koje je daleko od 02:00/03:00 DST tranzicija. `formatInTimeZone` daje stvarni kalendarski datum nakon shift-a, ne pomjereni epoch.

**Edge cases:**

- DST proljeće (mart): sedmica koja prelazi DST ima 7×24h - 1h fizički, ali kalendarski 7 dana — funkcija vraća tačnu sljedeću ponedjeljak ponoć.
- DST jesen (oktobar): kalendarski dan ima 25h, isto OK.
- Februar prestupne godine (2028): mjesec ima 29 dana, `format("01")` strategija ne pretpostavlja dužinu.
- Sedmica preko Nove godine: pomak po podnevu kroz UTC ne brine za godinu.
- Mjesec na kraju godine (decembar→januar): isto.

### `src/lib/utils/admin-prefs.ts` (proširenje)

```typescript
export type ResolvedTerminiPrefs = {
  date: string | undefined;
  range: "danas" | "sedmica" | "mjesec" | "svi";
  status: "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";
  sort: "asc" | "desc";
  /** True ako sort nije eksplicit od user-a (ni URL ni cookie) i izveden je
   *  iz date/range. Koristi se u URL builder-ima — kad je default, ne dodajemo
   *  ?sort= u URL (čisći). */
  isDefaultSort: boolean;
};

/**
 * Resolve URL + cookie u finalne, normalizovane prefs.
 * Per-param merge: missing URL params fallback na cookie value.
 * Date/range međusobno isključivost se rješava unutar funkcije.
 */
export function resolveTerminiPrefs(
  urlParams: { date?: string; range?: string; status?: string; sort?: string },
  cookiePrefs: TerminiPrefs,
): ResolvedTerminiPrefs;

/**
 * Default sort izračun: ASC za single-day (date setovan ili range=danas),
 * DESC inače. Izložena posebno radi reuse u URL builder-ima.
 */
export function computeDefaultSort(args: {
  date: string | undefined;
  range: "danas" | "sedmica" | "mjesec" | "svi";
}): "asc" | "desc";
```

**Resolve algoritam (deterministički, 4 koraka):**

Notacija: `urlDate`, `urlRange`, `urlStatus`, `urlSort` = validirani URL params (invalid → undefined).

1. **date:**
   - Ako `urlRange` je setovan → `date = urlDate` (user je eksplicit izabrao range, cookie-ev date se odbacuje).
   - Inače → `date = urlDate ?? cookiePrefs.date`.
2. **range:**
   - Ako `date` (iz koraka 1) postoji → `range = "svi"` (date pobjeđuje range, isto kao trenutna semantika).
   - Inače → `range = urlRange ?? cookiePrefs.range ?? "svi"`.
3. **status:** `urlStatus ?? cookiePrefs.status ?? "svi"`.
4. **sort:**
   - `defaultSort = computeDefaultSort({ date, range })`.
   - `explicit = urlSort ?? cookiePrefs.sort` (validan asc/desc).
   - `sort = explicit ?? defaultSort`.
   - `isDefaultSort = explicit === undefined`.

**Provjera ključnih edge case-ova:**

- URL `{range: "sedmica"}` + cookie `{date: "X"}` → date=undef (korak 1 odbacuje cookie date jer urlRange postoji), range="sedmica".
- URL `{date: "Y"}` + cookie `{range: "Z"}` → date="Y", range="svi".
- URL `{date: "Y", range: "Z"}` (oba u URL-u) → date="Y", range="svi" (date pobjeđuje, konzistentno sa postojećim ponašanjem page.tsx:96-100).
- URL `{status: "ceka"}` + cookie `{date: "Y", range: "Z"}` → date="Y" iz cookie-ja, range="svi" (date dio cookie-ja se zadržava jer URL nema range; range dio cookie-ja se ignoriše jer date pobjeđuje).
- URL prazan + cookie `{date: "Y", range: "Z"}` → date="Y", range="svi" (cookie može imati oba iz starije verzije, date pobjeđuje).

### `src/lib/utils/termini-filters.ts` (NEW)

```typescript
export type AppointmentsBoundsFilter =
  | { kind: "bounded"; gte: string; lt: string }
  | { kind: "unbounded" };

/**
 * Prevodi resolved prefs u Supabase query bounds. Single source of truth.
 * Garancija: svaka opcija (date, range=danas/sedmica/mjesec/svi) koristi
 * Sarajevo TZ. Server TZ ne curi u rezultat.
 *
 * `now` parametar omogućava deterministički unit test (fiksni datum).
 */
export function buildAppointmentsBoundsFilter(
  resolved: Pick<ResolvedTerminiPrefs, "date" | "range">,
  now?: Date,
): AppointmentsBoundsFilter;
```

Implementacija: ako `resolved.date` → `getSarajevoDayBounds(date)`. Inače switch na `resolved.range`:
- `"danas"` → `getSarajevoDayBounds(sarajevoTodayDateStr(now))` (isti rezultat kao `?date=<today>`).
- `"sedmica"` → `getSarajevoWeekBounds(sarajevoTodayDateStr(now))`.
- `"mjesec"` → `getSarajevoMonthBounds(sarajevoTodayDateStr(now))`.
- `"svi"` → `{ kind: "unbounded" }`.

## Paginacija (nalaz C)

**Konstanta:**

```typescript
const APPOINTMENTS_LIMIT = 500;
```

500 je dovoljno za 12+ mjeseci normalnog operativnog protoka jednog salona, ali dovoljno mali da hit Supabase default cap-a (1000) ostane buffer za rast.

**Query izmjene u page.tsx:**

```typescript
appointmentsQuery = appointmentsQuery.limit(APPOINTMENTS_LIMIT);

// Posebni count query (brz, head: true):
const totalCountQuery = applyFilters(
  sb.from("appointments").select("id", { count: "exact", head: true })
);
if (resolved.status !== "svi") {
  totalCountQuery = totalCountQuery.eq("status", resolved.status);
}
```

**UI indikator** (samo ako `totalMatching > APPOINTMENTS_LIMIT`):

```tsx
{totalMatching && totalMatching > APPOINTMENTS_LIMIT && (
  <p className="mt-4 border border-cream bg-white p-3 text-xs text-light">
    Prikazano {APPOINTMENTS_LIMIT} od {totalMatching} termina.
    Suzite filter za prikaz preostalih.
  </p>
)}
```

Diskretno ispod liste, mali tekst, koristi postojeće cream/light brand boje.

## page.tsx nova struktura

```typescript
export default async function AdminTerminiPage({ searchParams }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookiePrefs = parseTerminiPrefs(cookieStore.get(TERMINI_PREFS_COOKIE)?.value);

  const resolved = resolveTerminiPrefs(params, cookiePrefs);
  const bounds = buildAppointmentsBoundsFilter(resolved);

  const sb = await createClient();
  const now = new Date();
  const todayStr = sarajevoTodayDateStr(now);

  // settings + maxDateStr — nepromjenjeno
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
  const maxDateStr = addDaysToDateStr(todayStr, bookingSettings.advanceBookingDays);

  const applyBounds = <Q extends SupabaseQuery>(q: Q): Q => {
    if (bounds.kind === "bounded") {
      return q.gte("start_time", bounds.gte).lt("start_time", bounds.lt) as Q;
    }
    return q;
  };

  let appointmentsQuery = applyBounds(
    sb.from("appointments")
      .select("id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)")
      .order("start_time", { ascending: resolved.sort === "asc" })
      .limit(APPOINTMENTS_LIMIT)
  );
  if (resolved.status !== "svi") {
    appointmentsQuery = appointmentsQuery.eq("status", resolved.status);
  }

  const countsQuery = applyBounds(sb.from("appointments").select("status"));

  let totalCountQuery = applyBounds(
    sb.from("appointments").select("id", { count: "exact", head: true })
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
    sb.from("services").select("*").eq("bookable", true).eq("active", true).order("order_index"),
    countsQuery,
    totalCountQuery,
  ]);

  // ostatak (groups, header, render) — nepromjenjen osim:
  // - rangeParam → resolved.range
  // - statusFilter → resolved.status
  // - sort → resolved.sort
  // - defaultSort → resolved.isDefaultSort ? resolved.sort : computeDefaultSort(resolved)
  // - dodaj <PaginationIndicator total={totalMatching} limit={APPOINTMENTS_LIMIT} /> ispod liste
}
```

**Smanjenje:** ~316 → ~200 linija u page.tsx. Sva poslovna logika (resolve/bounds) testabilna izvan komponente.

## Testing strategy

### Unit tests

**`tests/unit/day-bounds.test.ts`** (proširenje postojećeg fajla ako postoji, inače novi):

- `getSarajevoWeekBounds`:
  - Mid-week date (npr. srijeda 2026-05-20) → start = ponedjeljak 2026-05-18 00:00 Sarajevo.
  - End - start spans exactly 7 calendar days (testira se preko `formatInTimeZone(end, TZ, "yyyy-MM-dd")`).
  - DST proljeće (sedmica koja sadrži 2026-03-29, kad DST počinje): bounds su ispravni, end format-uje kao 2026-04-06 00:00 (ponedjeljak nakon DST).
  - DST jesen (sedmica koja sadrži 2026-10-25): isto.
  - Sedmica preko godine (2026-12-28 do 2027-01-03): start = 2026-12-28, end = 2027-01-04.
  - Invalid date string → throws.
- `getSarajevoMonthBounds`:
  - 2026-05-15 → start = 2026-05-01 00:00 Sarajevo, end = 2026-06-01 00:00 Sarajevo.
  - Februar 2028 (prestupna): end = 2028-03-01 00:00, period 29 dana.
  - Decembar 2026 → januar 2027.
  - Mjesec sa DST tranzicijom (mart, oktobar): bounds tačni.

**`tests/unit/admin-prefs.test.ts`** (novi):

- `resolveTerminiPrefs`:
  - URL prazan + cookie prazan → `{date: undefined, range: "svi", status: "svi", sort: "desc", isDefaultSort: true}`.
  - URL `{status: "ceka"}` + cookie `{range: "mjesec", sort: "asc"}` → `status=ceka, range=mjesec, sort=asc, isDefaultSort=false` (nalaz D fix).
  - URL `{range: "sedmica"}` + cookie `{date: "2026-05-19"}` → `range=sedmica, date=undefined, sort=desc default`.
  - URL `{date: "2026-05-19"}` → `range="svi"` forsiran, `sort=asc` default (single-day).
  - Cookie `{date: "X", range: "Y"}` + URL prazan → date pobjeđuje, range="svi" forsiran.
  - Invalid date u URL (`?date=garbage`) → ignoriše se, pada na cookie.
  - URL `?sort=foobar` → ignoriše se, isDefaultSort=true.
- `computeDefaultSort`:
  - `{date: "2026-05-19"}` → "asc".
  - `{range: "danas"}` → "asc".
  - `{range: "sedmica"|"mjesec"|"svi"}` → "desc".

**`tests/unit/termini-filters.test.ts`** (novi):

- `buildAppointmentsBoundsFilter`:
  - Sa `date` → ignoriše range, vraća day bounds.
  - Sa `range=danas` i fiksiran `now` u 23:30 Sarajevo lokalno → **identičan** rezultat kao sa `date=<today>`. Ovo je core regression test za nalaz A.
  - Sa `range=svi` → `{kind: "unbounded"}`.
  - Sa `range=sedmica` u mid-week → bounds = ponedjeljak ponoć → sljedeći ponedjeljak ponoć.
  - Sa `range=mjesec` mid-month → bounds = 1. ponoć → 1. sljedećeg ponoć.

### E2E test

**`tests/e2e/admin-termini-tz.spec.ts`** (novi):

- Setup: u global setup ili in-test, kreiraj termin sa `start_time` koji odgovara `00:30 Sarajevo today`. Konkretno:
  ```typescript
  const startMs = new Date(
    getSarajevoDayBounds(sarajevoTodayDateStr()).start
  ).getTime() + 30 * 60 * 1000;
  const startTime = new Date(startMs).toISOString();
  ```
  Ime klijenta mora počinjati prefiksom koji global setup briše (`E2E*` ili `Test Klijent*` — provjeriti `tests/e2e/utils/seed.ts` deletion regex prije izbora).
- Login kao admin.
- Idi na `/admin/termini?range=danas`.
- Očekuj: termin je u listi (visible client_name).
- Idi na `/admin/termini?date=<today>` (`<today>` = `sarajevoTodayDateStr()`).
- Očekuj: isti termin je u listi.

Bonus assertion: count termina pod `?range=danas` jednak je count-u pod `?date=<today>`. Čvrsta regresija konzistencije za nalaz A.

## Implementation plan

Konkretni redoslijed izvođenja (refinementi u writing-plans skill-u):

1. Dodaj `getSarajevoWeekBounds` i `getSarajevoMonthBounds` u `day-bounds.ts` + unit testovi.
2. Dodaj `ResolvedTerminiPrefs`, `resolveTerminiPrefs`, `computeDefaultSort` u `admin-prefs.ts` + unit testovi.
3. Kreiraj `termini-filters.ts` sa `buildAppointmentsBoundsFilter` + unit testovi.
4. Refaktoriši `page.tsx` da koristi nove helpere, dodaj `APPOINTMENTS_LIMIT`, total count query, indikator komponentu.
5. Dodaj e2e test `admin-termini-tz.spec.ts`.
6. Pokreni `npm run typecheck && npm run lint && npm test && npm run test:e2e:local`.

## Risks

- **TZ math greška u helperima.** Mitigacija: ekspanzivni unit testovi za DST tranzicije (proljeće/jesen), godina granice, prestupne februare.
- **Page.tsx render regresija.** Mitigacija: `resolved.range`, `resolved.status`, `resolved.sort` se ponašaju isto kao postojeći `rangeParam`/`statusFilter`/`sort` — render kod nije promijenjen u semantici.
- **Cookie per-param merge mijenja user-vidljivo ponašanje (nalaz D).** Mitigacija: dokumentovano u commit poruci, prihvaćen tradeoff (user izabrao "intuitivno").
- **`now` injection u helpere može curiti u testovima koji ne prosljeđuju.** Mitigacija: default `now = new Date()` je u potpisu, u produkciji se ne mijenja ponašanje.

## Open questions

Nema. Sve odluke su donijete kroz brainstorming dijalog:
- Scope: A + B + C + D.
- Cookie: per-param merge.
- Helper API: diskretne funkcije per opseg.
- Pagination: hard cap 500 + indikator.
- Tests: unit (helperi + cookie) + e2e regression.
- Strukturni pristup: Modular (extract resolve i bounds u helpere, page.tsx ostaje orchestrator).
