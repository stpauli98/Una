# `computeAvailableSlots()` — availability engine

**Fajl:** `src/lib/booking/availability.ts`

Centralna pure function koja računa koje slotove klijent može rezervisati za dati dan i uslugu.

## Signature

```typescript
export function computeAvailableSlots(input: AvailabilityInput): Slot[];
```

## Input

```typescript
export type AvailabilityInput = {
  /** Ponoć ciljanog dana u Sarajevo TZ */
  date: Date;
  /** Trajanje usluge u minutima */
  durationMin: number;
  /** Trenutno vrijeme (za min_hours_before i prošlost) */
  now: Date;
  /** Postojeći termini iz baze (status ceka/potvrdjen) */
  existing: ExistingAppointment[];
  /** Blokirani datumi */
  blocked: BlockedRange[];
  /** Sub-day vremenski blokovi */
  blockedTimes?: ExistingAppointment[];
  /** Radno vrijeme per weekday (0=ned..6=sub) */
  hoursByWeekday?: DailyHoursMap;
  /** Admin može preskočiti min_hours_before */
  skipMinHoursBefore?: boolean;
  /** Settings iz DB */
  settings?: BookingSettings;
};
```

## Output

```typescript
type Slot = {
  start: Date;
  end: Date;
};
```

Array of `Slot`-ova, sorted po `start`. Empty array znači nema dostupnosti.

## Algoritam — korak po korak

### 1. Provjera prošlosti

```typescript
const target = startOfDay(date);
const today = startOfDay(now);

if (isBefore(target, today)) return [];
```

Ako je datum u prošlosti — vrati prazno.

### 2. Provjera max advance

```typescript
const advanceDays = settings?.advanceBookingDays ?? BOOKING_RULES.advance_booking_days;
const daysAhead = differenceInCalendarDays(target, today);
if (daysAhead > advanceDays) return [];
```

Ako je datum više od `advance_booking_days` u budućnosti — vrati prazno.

### 3. Provjera blocked_dates

```typescript
for (const range of blocked) {
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  if (target >= from && target <= to) return [];
}
```

Ako je datum unutar bilo kojeg `blocked_dates` raspona — vrati prazno (cijeli dan blokiran).

### 4. Provjera radnog vremena

```typescript
const weekday = target.getDay();
const hours = hoursByWeekday?.[weekday] ?? getHoursForDay(weekday);
if (!hours.isOpen) return [];
```

Ako je dan zatvoren (`is_open=false` u DB) — vrati prazno.

### 5. Generisanje slotova

```typescript
const [openH, openM] = hours.open.split(":").map(Number);
const [closeH, closeM] = hours.close.split(":").map(Number);

const dayOpen = new Date(target);
dayOpen.setHours(openH, openM, 0, 0);
const dayClose = new Date(target);
dayClose.setHours(closeH, closeM, 0, 0);

const slots: Slot[] = [];
let cursor = dayOpen;

while (true) {
  const end = addMinutes(cursor, durationMin);
  if (end > dayClose) break;  // Slot ne stane u radno vrijeme

  // 6. Provjera min_hours_before
  if (!skipMinHoursBefore) {
    const minHours = settings?.minHoursBefore ?? BOOKING_RULES.min_hours_before;
    if (differenceInHours(cursor, now) < minHours) {
      cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
      continue;  // Slot je previše blizu sad
    }
  }

  // 7. Provjera overlap-a sa postojećim
  const breakMin = settings?.breakBetweenMin ?? 0;
  const allBlocking = [...existing, ...(blockedTimes ?? [])];
  const overlaps = allBlocking.some((item) => {
    const effectiveEnd = breakMin > 0 ? addMinutes(item.end, breakMin) : item.end;
    return cursor < effectiveEnd && end > item.start;
  });
  
  if (!overlaps) {
    slots.push({ start: new Date(cursor), end });
  }

  cursor = addMinutes(cursor, SLOT_INTERVAL_MIN);
}

return slots;
```

## Cross-service blocking

Ključna karakteristika: **`existing` parametar uključuje SVE active appointments**, ne filtrirano po `service_id`.

Razlog: Una je jedan resurs. Ako radi šminkanje 17:00-18:00, ne može u isto vrijeme raditi pedikir.

API ruta to forsira:

```typescript
// src/app/api/availability/route.ts
const { data: appts } = await sb
  .from("appointments")
  .select("start_time, end_time")
  .in("status", ["ceka", "potvrdjen"])
  // NEMA .eq("service_id", serviceId) FILTER!
  .lt("start_time", dayEnd)
  .gt("end_time", dayStart);
```

E2E test: `tests/e2e/booking-cross-service.spec.ts` (2 testa).

## Grid pattern (Cal.com)

Slotovi se generišu na **fiksnih 30 minuta** (`SLOT_INTERVAL_MIN`), nezavisno od trajanja usluge.

**Primjer 1:** Šminkanje 60 min, radno 17:00-21:00

```
Slot: 17:00 → 18:00
Slot: 17:30 → 18:30
Slot: 18:00 → 19:00
Slot: 18:30 → 19:30
Slot: 19:00 → 20:00
Slot: 19:30 → 20:30
Slot: 20:00 → 21:00
(20:30 → 21:30 ne stane → prekid)
```

7 slotova.

**Primjer 2:** Trepavice 180 min, radno 17:00-21:00

```
Slot: 17:00 → 20:00
Slot: 17:30 → 20:30
Slot: 18:00 → 21:00
(18:30 → 21:30 ne stane → prekid)
```

3 slota.

**Primjer 3:** Termin 17:30-18:00 (30 min) je rezervisan. Šminkanje 60 min:

```
17:00 → 18:00  — OVERLAP (17:30 je u rezervisanom)  ❌
17:30 → 18:30  — OVERLAP                              ❌
18:00 → 19:00  — OK                                    ✅
18:30 → 19:30  — OK                                    ✅
...
```

## Break between

`break_between_min` produžava effective end postojećih termina:

```
Termin: 17:00 → 18:00
break_between_min = 30
effective end: 18:30
```

Slot 18:00-19:00 sad overlap-uje sa effective end (18:30) → blokiran.

Slot 18:30-19:30 je OK (počinje u 18:30, ne overlap-uje).

## Test coverage

**127 unit testova** u `tests/unit/availability.test.ts`. Pokriva:

- Sve service durations (30, 60, 90, 120, 150, 180 min)
- Empty day
- Full day
- Existing appointments na boundary
- Sub-day time blocks
- Off-grid time blocks (npr. 17:15-17:45 blokira slotove)
- DST transition days
- Edge case: cursor točno na dayClose
- Edge case: last slot ends exactly at dayClose
- Skip min_hours_before (admin)
- Various `min_hours_before` values
- `advance_booking_days` boundary
- Past dates
- Blocked dates ranges
- Working hours overrides
- Settings fallback to BOOKING_RULES

## Performance

Engine je pure i sinhron. Tipično < 1ms za jedan dan računaja.

Bottleneck je DB fetch (parallel queries u API ruti):

```typescript
const [apptRes, blockedRes, hoursRes, timeBlocksRes, settingsRes] =
  await Promise.all([...]);
```

5 parallel queries, ukupno ~50-100ms u Frankfurt regionu.

## Sledeće

- [grid.md](./grid.md) — 30-min grid detalje
- [working-hours.md](./working-hours.md) — radno vrijeme
- [race-conditions.md](./race-conditions.md) — sprjecavanje duplog booking-a
