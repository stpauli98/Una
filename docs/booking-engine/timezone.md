# Timezone — Europe/Sarajevo

**Fajl:** `src/lib/utils/tz.ts`

Sve datum/vrijeme operacije u Sarajevo timezone-u (CET / CEST). Bez ovoga, Vercel serverless (UTC) bi davao pogrešne slotove.

## Konstanta

```typescript
// src/lib/constants/business.ts
export const BUSINESS = {
  // ...
  timezone: "Europe/Sarajevo",
};

// src/lib/utils/tz.ts
export const TZ = BUSINESS.timezone;
```

## Tri helpera

### 1. `nowSarajevo()` — sadašnje vrijeme u Sarajevo TZ

```typescript
import { toZonedTime } from "date-fns-tz";

export function nowSarajevo(): Date {
  return toZonedTime(new Date(), TZ);
}
```

**Use case:** `min_hours_before` check. Bez ovoga, `new Date()` na Vercelu daje UTC.

### 2. `parseDateSarajevo(dateStr)` — parsira YYYY-MM-DD kao Sarajevo midnight

```typescript
import { fromZonedTime } from "date-fns-tz";

export function parseDateSarajevo(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, TZ);
}
```

**Use case:** Availability API prima `?date=2026-06-15`. Treba parsirati kao "midnight 15. juna u Sarajevu", što je internal `2026-06-14T22:00:00Z` (CEST).

**Test case:**
```
parseDateSarajevo("2026-06-15")
→ Date(2026-06-14T22:00:00.000Z)  // = 2026-06-15 00:00 CEST
```

### 3. `atSarajevo(year, month, day, hour, min)`

```typescript
export function atSarajevo(
  year: number, month: number, day: number,
  hour: number, min = 0,
): Date {
  const local = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:00`;
  return fromZonedTime(local, TZ);
}
```

**Use case:** Kreiraj Date za 17:00 Sarajevo (čak ako server je UTC).

**Test case:**
```
atSarajevo(2026, 6, 15, 17, 0)
→ Date(2026-06-15T15:00:00.000Z)  // = 17:00 CEST
```

### 4. `parseSarajevoDateTime(dateStr, timeStr)`

```typescript
export function parseSarajevoDateTime(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TZ);
}
```

**Use case:** Admin UI komponente koje imaju `<input type="date">` + time `<select>`. Snimanje u DB.

Sirov `new Date("2026-06-15T18:00")` bi koristio **browser-local timezone**. Ako admin u UK timezone-u (UTC), to bi dalo pogrešan UTC.

## Zašto je ovo bitno

### Problem: Vercel = UTC, Sarajevo = CET/CEST

Vercel serverless je u UTC. Sarajevo je UTC+1 (CET, zima) ili UTC+2 (CEST, ljeto).

Bez TZ helpera:

```typescript
// LOŠE — bez helpera
const now = new Date();              // Vercel: UTC
const target = startOfDay(parseISO("2026-06-15"));  // Vercel: UTC midnight = 2026-06-15 00:00:00Z

// Slot at 17:00:
const slot = setHours(target, 17);   // Vercel: 17:00 UTC = 19:00 Sarajevo
```

Klijent vidi slot "19:00" iako Una otvara u 17:00. Pogrešno!

### Sa helperima

```typescript
// DOBRO — sa helperima
const now = nowSarajevo();
const target = parseDateSarajevo("2026-06-15");  // 22:00Z prethodnog dana = midnight Sarajevo
// ...computeAvailableSlots dobija date u Sarajevo TZ
```

## DST transition

Last Sunday March: CET → CEST (gubimo sat: 02:00 → 03:00)
Last Sunday October: CEST → CET (dobijamo sat: 03:00 → 02:00)

Za UP Makeup: radno vrijeme 17:00-21:00 (weekday) i 05:00-21:00 (weekend). DST se desi u 02:00 — **ne utiče na radno vrijeme**.

Edge case (irelevantan u praksi): ako se ikad otvori 02:00, jedan sat može biti duplikat ili gap. `date-fns-tz` handle-uje to korektno.

## Database storage

Svi `timestamptz` polja u Supabase se cuvaju u UTC. Konverzija u Sarajevo se desava na server side prije slanja klijentu (ili na klijent strani za prikaz).

```sql
-- Stored UTC
start_time: 2026-06-15T15:00:00.000Z

-- Display "17:00" u Sarajevo
```

## Format prikaza

```typescript
// src/lib/utils/format.ts
export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}
```

`date-fns` `format` koristi **system timezone**. Na klijentu (browser), to je local timezone klijenta.

Klijent u Sarajevu vidi `17:00`. Klijent u Berlin (CET+1 dakle isti) vidi `17:00`. Klijent u New Yorku (UTC-5) bi vidio `11:00`.

**Rješenje:** Sajt se obraća lokalnoj publici (Gradiška), pa preferiramo Sarajevo TZ za sve. Ako bi se ikad otvorilo internacionalno, treba `toZonedTime` + `format` u prikazu.

## E2E test helper

`tests/e2e/helpers.ts`:

```typescript
export function sarajevoDate(year, month, day, hour, min = 0): Date {
  const temp = new Date(Date.UTC(year, month - 1, day, hour, min));
  const offsetMatch = /* detektuj offset */;
  return new Date(Date.UTC(year, month - 1, day, hour - offsetHours, min));
}
```

Koristi se u e2e testovima za seedovanje TZ-correct podataka, nezavisno od CI runner TZ-a.

## Test coverage

| Test | Lokacija |
|------|----------|
| TZ helpers unit | `tests/unit/tz.test.ts` |
| DST transition | `tests/unit/availability.test.ts` (par cases) |
| E2E sa sarajevoDate | `tests/e2e/cancel-frees-slot.spec.ts`, ostali |

## Sledeće

- [availability.md](./availability.md) — gdje se TZ koristi u glavnom algoritmu
- [working-hours.md](./working-hours.md) — TZ + radno vrijeme
