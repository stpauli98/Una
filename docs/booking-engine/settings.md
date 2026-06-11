# Settings — booking pravila

**Tabela:** `settings` (key-value store)

Konfigurabilna booking pravila koje Una može mijenjati kroz admin panel.

## Schema

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Generički key-value — fleksibilno za buduće settings.

## Trenutni ključevi

| Key | Default (BOOKING_RULES) | Šta radi |
|-----|--------------------------|-----------|
| `min_hours_before` | 24 | Min sati prije rezervacije |
| `advance_booking_days` | 90 | Max dana unaprijed |
| `cancellation_hours` | 24 | Otkazivanje min sati prije |
| `break_between_min` | 0 | Pauza između termina (min) |

## Parser — `parseBookingSettings()`

**Fajl:** `src/lib/settings/read.ts`

```typescript
export function parseBookingSettings(rows: SettingsRow[]): BookingSettings {
  const map = new Map(rows.map(r => [r.key, r.value]));

  return {
    minHoursBefore: parseNum(map.get("min_hours_before"), BOOKING_RULES.min_hours_before),
    advanceBookingDays: parseNum(map.get("advance_booking_days"), BOOKING_RULES.advance_booking_days),
    cancellationHours: parseNum(map.get("cancellation_hours"), BOOKING_RULES.cancellation_hours),
    breakBetweenMin: parseNum(map.get("break_between_min"), BOOKING_RULES.break_between_min),
  };
}

function parseNum(value: string | undefined, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
```

Defensive parsing — invalid value → fallback na BOOKING_RULES.

## Use cases

### `min_hours_before` — 24h pravilo

Klijent ne može rezervisati termin za "sutra ujutro" ako je sad 23:00 (sutra 09:00 je samo 10h).

```typescript
// computeAvailableSlots korak 6
if (!skipMinHoursBefore) {
  const minHours = settings?.minHoursBefore ?? BOOKING_RULES.min_hours_before;
  if (differenceInHours(cursor, now) < minHours) {
    cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
    continue;
  }
}
```

`skipMinHoursBefore: true` za admin manual booking (Una može unijeti za sad).

### `advance_booking_days` — 90 dana max

Klijent ne može rezervisati 6 mjeseci unaprijed.

```typescript
const daysAhead = differenceInCalendarDays(target, today);
if (daysAhead > advanceDays) return [];
```

### `break_between_min` — pauza između termina

Una hoće 30 min između termina za pripremu.

```typescript
const effectiveEnd = breakMin > 0 ? addMinutes(item.end, breakMin) : item.end;
```

Postojeći termin 17:00-18:00 + 30 min break = effective end 18:30.

Slot 18:00-19:00 blokiran. Slot 18:30-19:30 OK.

**Važno:** `break_between_min` mora biti **multiple od 30** (slot interval). UI i server validacija dozvoljavaju `0, 30, 60, 90, 120`.

Detalji: [grid.md](./grid.md), [../admin/postavke.md](../admin/postavke.md)

### `cancellation_hours` — otkazivanje

Klijent može otkazati termin min N sati prije. **Nije implementirano u kodu** — samo prikaz vremena u uslovima korišćenja.

(Klijent ne može otkazati kroz sajt — samo Una. Klijent javi WhatsApp-om.)

## Admin UI — `BookingRulesEditor`

**Fajl:** `src/components/admin/BookingRulesEditor.tsx`

4 dropdown-a sa preset vrijednostima:

| Setting | Opcije |
|---------|--------|
| `min_hours_before` | 0, 1, 2, 3, 6, 12, 24 |
| `advance_booking_days` | 7, 14, 30, 60, 90 |
| `cancellation_hours` | 0, 1, 2, 3, 6, 12, 24 |
| `break_between_min` | 0, 30, 60, 90, 120 |

Inline save per row.

## Server action — `updateSetting`

**Fajl:** `src/app/admin/(protected)/postavke/actions.ts`

```typescript
const ALLOWED_SETTING_KEYS = [
  "min_hours_before",
  "advance_booking_days",
  "cancellation_hours",
  "break_between_min",
] as const;

export async function updateSetting(key: string, value: string) {
  await requireAdmin();
  
  if (!ALLOWED_SETTING_KEYS.includes(key))
    return { ok: false, error: "Nepoznat ključ podešavanja" };

  const num = Number(value);
  if (!Number.isFinite(num) || num < 0)
    return { ok: false, error: "Vrijednost mora biti nenegativan broj" };

  if (key === "break_between_min" && ![0, 30, 60, 90, 120].includes(num))
    return { ok: false, error: "Pauza mora biti 0, 30, 60, 90 ili 120 minuta" };

  UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2
  
  revalidatePath("/admin/postavke");
}
```

## Migracija

`supabase/migrations/20260410_settings.sql`:

```sql
CREATE TABLE settings (...);

-- Seed defaults
INSERT INTO settings (key, value) VALUES
  ('min_hours_before', '24'),
  ('advance_booking_days', '90'),
  ('cancellation_hours', '24'),
  ('break_between_min', '0');
```

## Fallback behavior

Ako `settings` tabela nema red za neki ključ (npr. tek dodan novi key u kodu):

```typescript
const minHours = settings?.minHoursBefore ?? BOOKING_RULES.min_hours_before;
```

Engine koristi default iz `BOOKING_RULES`. Bez fallback-a bi sve booking palilo na NaN.

## Test

`tests/unit/settings.test.ts` (4 testa):
- Parse svih 4 ključa
- Single key sa fallback-om
- Invalid value (NaN) sa fallback-om
- Empty array → svi defaults

## Edge cases

### `min_hours_before = 0`

Klijent može rezervisati za "sad". Korisno tokom slow perioda ili za walk-in handling.

### `advance_booking_days = 7` (1 sedmica)

Klijent može rezervisati max 1 sedmica unaprijed. Korisno ako Una želi suzbiti dugoročne rezervacije.

### `break_between_min = 60`

Una hoće sat pauze između termina. Postojeći termin 17:00-18:00 → effective end 19:00 → sljedeći slot 19:00.

Ali UI dropdown trenutno ima samo `0` ili `30`. Server validation dozvoljava `0, 30, 60, 90, 120` ako bi se UI proširio.

### Negativni broj

UI ne dozvoljava. Server validira (`num < 0` → reject).
