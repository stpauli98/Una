# Radno vrijeme

**Tabela:** `working_hours`

7 redova — po jedan za svaki dan u sedmici.

## Schema

```sql
CREATE TABLE working_hours (
  day_of_week SMALLINT PRIMARY KEY,  -- 0=ned, 1=pon, ..., 6=sub
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  CHECK (close_time > open_time)
);
```

## Default vrijednosti (BOOKING_RULES)

| Dan | open | close | is_open |
|-----|------|-------|---------|
| Nedjelja (0) | 05:00 | 21:00 | true |
| Ponedjeljak (1) | 17:00 | 21:00 | true |
| Utorak (2) | 17:00 | 21:00 | true |
| Srijeda (3) | 17:00 | 21:00 | true |
| Četvrtak (4) | 17:00 | 21:00 | true |
| Petak (5) | 17:00 | 21:00 | true |
| Subota (6) | 05:00 | 21:00 | true |

Source: `src/lib/constants/business.ts`:

```typescript
export const BOOKING_RULES = {
  weekday: { open: "17:00", close: "21:00", days: [1,2,3,4,5] },
  weekend: { open: "05:00", close: "21:00", days: [0,6] },
  // ...
};
```

Razlog za rano otvaranje vikendom: svadbeno šminkanje (mladenke se šminkaju u 05:00-07:00).

## Fallback logic

`computeAvailableSlots()` koristi DB vrijednosti ako postoje, inače `BOOKING_RULES`:

```typescript
const hours = input.hoursByWeekday?.[weekday] ?? getHoursForDay(weekday);
```

`getHoursForDay(weekday)` (`src/lib/booking/rules.ts`):

```typescript
export function getHoursForDay(weekday: number, rules = BOOKING_RULES): DailyHours {
  if (rules.weekend.days.includes(weekday)) {
    return { open: rules.weekend.open, close: rules.weekend.close, isOpen: true };
  }
  return { open: rules.weekday.open, close: rules.weekday.close, isOpen: true };
}
```

## API ruta — fetch + parse

```typescript
// src/app/api/availability/route.ts
const { data: hoursRows } = await sb.from("working_hours").select("*");
const hoursByWeekday = hoursMapFromRows(hoursRows);

const slots = computeAvailableSlots({
  // ...
  hoursByWeekday,
});
```

`hoursMapFromRows()` (`src/lib/booking/rules.ts`):

```typescript
export function hoursMapFromRows(rows: WorkingHour[]): DailyHoursMap {
  const map: DailyHoursMap = {};
  for (const row of rows) {
    map[row.day_of_week] = {
      open: row.open_time.slice(0, 5),    // "HH:mm" iz "HH:mm:ss"
      close: row.close_time.slice(0, 5),
      isOpen: row.is_open,
    };
  }
  return map;
}
```

## Admin update

`WorkingHoursEditor` UI dozvoljava Uni:
- Toggle "Otvoreno" (is_open)
- Promijeni open_time (30-min grid select)
- Promijeni close_time (30-min grid select)

Inline save per row.

Detalji: [../admin/postavke.md](../admin/postavke.md)

## Validacija

### Zod schema (server action)

```typescript
const workingHourSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().regex(/^\d{2}:(00|30)$/),
  close_time: z.string().regex(/^\d{2}:(00|30)$/),
  is_open: z.boolean(),
});
```

Regex enforce 30-min grid.

### Database constraint

```sql
CHECK (close_time > open_time)
```

Spriječi `close_time < open_time` (npr. otvoren 21:00, zatvoren 17:00).

## Edge cases

### `is_open = false` za sve dane

Studio zatvoren. `computeAvailableSlots()` vraća `[]` za svaki dan.

```typescript
if (!hours.isOpen) return [];
```

### close_time = open_time (degenerate)

DB constraint (`close > open`) sprjecava. Ali ako se nekako dobije:

```typescript
while (true) {
  const end = addMinutes(cursor, durationMin);
  if (end > dayClose) break;  // Odmah break
  // ...
}
```

Loop break-uje na prvoj iteraciji → 0 slotova.

### Prelaz preko ponoći

`close_time` može biti najmanje `23:30` (max grid value). `close_time = 00:00` u sutra nije moguć trenutno (potrebno bi bilo dodatno polje "spans midnight").

Za UP Makeup ovo nije problem jer max je 21:00.

### Promjena radnog vremena sa postojećim terminima

Una može promijeniti radno vrijeme. Postojeći termini izvan novog radnog vremena ostaju u bazi (npr. ako je termin u 21:00 a Una skrati radno vrijeme do 19:00, postojeći termin ostaje).

To je intended behavior — postojeći termini su "history" i imaju prioritet.

Novi rezervacije nakon promjene će respektovati novo radno vrijeme.

## E2E test

`tests/e2e/working-hours.spec.ts`:

1. Override radnog vremena na 19:00-21:00 (umjesto 17:00-21:00) → očekuje samo 3 slota (19:00, 19:30, 20:00 ako 60min)
2. Override `is_open = false` za određeni dan → očekuje 0 slotova
