# 30-min grid (slot interval)

**Fajl:** `src/lib/utils/grid.ts`

Svi slotovi su na fiksnom 30-minutnom gridu. Niko ne može unijeti `17:15` ili `18:45`.

## Konstanta

```typescript
// src/lib/booking/availability.ts
export const SLOT_INTERVAL_MIN = 30;
```

## Validacija — `isGridAligned()`

```typescript
export function isGridAligned(date: Date): boolean {
  return date.getMinutes() % 30 === 0;
}
```

### Test cases

| Vrijeme | `isGridAligned` |
|---------|-----------------|
| `17:00` | ✅ true |
| `17:30` | ✅ true |
| `17:15` | ❌ false |
| `17:45` | ❌ false |
| `17:01` | ❌ false |

## Strict version — `assertGridAligned()`

```typescript
export function assertGridAligned(date: Date): void {
  if (!isGridAligned(date)) {
    throw new Error(
      `Vrijeme termina mora biti na :00 ili :30. Dobiveno: ${formatTime(date)}`,
    );
  }
}
```

Throws ako nije aligned.

## Gdje se koristi

### 1. Klijent booking (`createAppointment`)

```typescript
const start = new Date(parsed.data.start_time);
if (!isGridAligned(start)) {
  return {
    ok: false,
    error: "Vrijeme termina mora biti na pun sat ili pola (:00 ili :30)",
  };
}
```

Iako UI ne dozvoljava izbor off-grid slota, server validira **defense-in-depth** (curl ili DevTools mogu probati).

### 2. Manuelni admin booking (`createManualAppointment`)

Isti check. Admin ne može ručno unijeti `17:15` čak ni sa `force=true`.

### 3. Time blocks (`createTimeBlock`)

```typescript
if (!isGridAligned(startDate) || !isGridAligned(endDate)) {
  return {
    ok: false,
    error: "Vrijeme mora biti na pun sat ili pola (:00 ili :30)",
  };
}
```

Una ne može unijeti pauzu od `13:15` do `14:05`.

### 4. Working hours (`updateWorkingHour`)

Zod schema:

```typescript
open_time: z.string().regex(/^\d{2}:(00|30)$/),
close_time: z.string().regex(/^\d{2}:(00|30)$/),
```

Una ne može postaviti radno vrijeme `17:15`.

## UI enforcement

Sve UI komponente za time input koriste **`<select>`** sa fiksnim opcijama:

```typescript
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});
```

48 opcija (`00:00` do `23:30`).

**Komponente:**
- `WorkingHoursEditor` — open/close time
- `TimeBlocksManager` — start/end time
- `ManualAppointmentForm` (custom mode) — custom_time select
- `ServiceForm` — duration_min select (multiples of 30)

## Zašto fiksan grid

### Cal.com pattern

Ako bi slot interval bio jednak trajanju usluge, kratki termini bi gubili slotove:

**Loš primer (variable grid):**
- Usluga A 30 min: slotovi 17:00, 17:30, 18:00...
- Termin u 17:00-17:30 → sljedeći slot 17:30
- ALI: drugi klijent rezerviše uslugu B 60 min → može početi u 17:00, 17:30, 18:00...
- Ako Klijent A ima 17:00-17:30, Klijent B može u 17:30

**Sa fiksnim 30-min gridom:** uvijek isti slotovi nezavisno od trajanja.

### Predvidljivost

Klijent uvijek vidi iste 30-min slotove. Cal.com, Acuity, Fresha — svi koriste fiksan grid.

### Database constraint

Bez 30-min grida, ne bismo mogli efikasno provjeriti overlap. Sa gridom, slotovi su predvidljivi i može se koristiti `EXCLUDE USING gist` constraint.

## Edge cases

### Pollution attack

Hipotetski: napadač pravi POST sa `start_time = "2026-06-15T17:15:00"`. Server vraća error:

```
Vrijeme termina mora biti na pun sat ili pola (:00 ili :30)
```

Bez ovog check-a, off-grid termin bi razbio slot generation za sve sljedeće rezervacije tog dana.

### Migration scenario

Ako bi se promijenio `SLOT_INTERVAL_MIN` (npr. na 15 min), trebalo bi:

1. Update svih `working_hours` da budu na 15-min grid (već su, jer je radno 17:00/21:00)
2. Update svih `time_blocks` (mogu postati legacy)
3. Update svih postojećih `appointments` (mogu ostati legacy, novi će biti na novom gridu)
4. Update UI `TIME_OPTIONS` na 96 stavki

Ali sa fiksnim 30 min, ovo se nikad neće desiti.

## Testovi

| Test | Lokacija |
|------|----------|
| `isGridAligned` unit | `tests/unit/grid.test.ts` (8 cases) |
| `assertGridAligned` throws | Isto |
| Server enforcement | `tests/unit/booking-schemas.test.ts` (indirektno) |
| E2E custom time | `tests/e2e/admin-manual-booking.spec.ts` |
