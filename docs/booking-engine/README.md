# Booking engine — pregled

Srce aplikacije. Logika koja računa koje slotove klijent može rezervisati.

## High-level

```
Klijent → /zakazi → bira datum
              ↓
       GET /api/availability?date=...&service_id=...
              ↓
       Server: fetcha iz baze
              ↓
       computeAvailableSlots() — pure function
              ↓
       Vraća array of {start, end}
              ↓
       UI prikazuje slot dugmad
```

## Ključni fajlovi

| Fajl | Šta sadrži |
|------|------------|
| `src/lib/booking/availability.ts` | `computeAvailableSlots()` — pure function |
| `src/lib/booking/month-availability.ts` | Računa koji datumi imaju slotove (za kalendar) |
| `src/lib/booking/rules.ts` | `BOOKING_RULES` constants, hours map helpers |
| `src/lib/booking/schemas.ts` | Zod schemas (`bookingFormSchema`, `manualAppointmentSchema`) |
| `src/lib/settings/read.ts` | `parseBookingSettings()` iz DB |
| `src/lib/utils/grid.ts` | `isGridAligned()`, `assertGridAligned()` |
| `src/lib/utils/tz.ts` | Sarajevo TZ helperi |
| `src/app/api/availability/route.ts` | API endpoint |
| `src/app/api/availability/month/route.ts` | Mjesečna availability |
| `src/types/booking.ts` | Domain types (`Slot`, `DailyHours`, itd.) |

## Pravila — sažetak

| Pravilo | Default | Promjenljivo (kroz Una) |
|---------|---------|--------------------------|
| Slot interval | 30 min | ❌ (Cal.com pattern) |
| Working hours | Mon-Fri 17-21, Sat-Sun 5-21 | ✅ `working_hours` tabela |
| Blocked dates | (prazno) | ✅ `blocked_dates` tabela |
| Time blocks | (prazno) | ✅ `time_blocks` tabela |
| Min hours before | 24h | ✅ `settings.min_hours_before` |
| Advance booking days | 90 | ✅ `settings.advance_booking_days` |
| Break between | 0 min | ✅ `settings.break_between_min` |
| Cross-service blocking | Da | ❌ (single operator) |

## Algoritam (uprošćeno)

```
function computeAvailableSlots(input) {
  // 1. Provjeri prošlost
  if (date < today) return [];

  // 2. Provjeri max advance
  if (date > today + advance_booking_days) return [];

  // 3. Provjeri blocked_dates
  for each blocked in blocked_dates:
    if (date overlap blocked) return [];

  // 4. Dohvati working hours za taj dan u sedmici
  let hours = getHoursForWeekday(date.getDay());
  if (!hours.isOpen) return [];

  // 5. Generiši slotove
  let slots = [];
  let cursor = date + open_time;
  while (cursor + duration <= date + close_time) {
    if (min_hours_before && cursor < now + min_hours_before) {
      cursor += 30min;
      continue;
    }
    
    if (overlapsAny(cursor, duration + break_between_min, existing + time_blocks)) {
      cursor += 30min;
      continue;
    }
    
    slots.push({ start: cursor, end: cursor + duration });
    cursor += 30min;
  }

  return slots;
}
```

Detalji: [availability.md](./availability.md)

## Pojedinacni fajlovi

| Tema | Fajl | Šta pokriva |
|------|------|-------------|
| Availability engine | [availability.md](./availability.md) | `computeAvailableSlots()` algoritam |
| 30-min grid | [grid.md](./grid.md) | Fiksni interval, alignment |
| Timezone | [timezone.md](./timezone.md) | Europe/Sarajevo handling |
| Radno vrijeme | [working-hours.md](./working-hours.md) | Per-weekday hours |
| Blokirani dani | [blocked-dates.md](./blocked-dates.md) | Full-day blocks |
| Time blocks | [time-blocks.md](./time-blocks.md) | Pod-dan blokade |
| Settings | [settings.md](./settings.md) | min_hours_before, itd. |
| Race condition | [race-conditions.md](./race-conditions.md) | Sprjecavanje duplog booking-a |
| Confirmation token | [confirmation-token.md](./confirmation-token.md) | UUID anti-IDOR |
