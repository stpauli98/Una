# Configurable Booking Rules — Design

**Date:** 2026-04-10
**Status:** Approved
**Scope:** 4 booking pravila koja Una može da konfiguriše iz admin panela umjesto hardkodovanih konstanti.

## Problem

`BOOKING_RULES` u `src/lib/constants/business.ts` su hardkodovane konstante. Una ne može da ih mijenja bez deploy-a. Konkretno:

- `min_hours_before: 24` — klijenti ne mogu zakazati unutar 24h, što je previše restriktivno za beauty studio
- `advance_booking_days: 90` — možda Una želi 30 ili 60 dana
- `cancellation_hours: 24` — prikazuje se na uspješnoj stranici, Una bi mogla htjeti 12h ili 6h
- `break_between_min: 0` — Una nema pauzu između termina za čišćenje/pripremu

## Decision — Pristup A: `settings` key-value tabela

Nova tabela `settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)` sa 4 seed reda. Admin UI čita/piše. `computeAvailableSlots` prima vrijednosti kao parametar. `BOOKING_RULES` ostaje kao fallback.

## Šema

```sql
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
```

RLS: public read (availability engine čita na svaki request), authenticated write (samo admin mijenja).

## Pravila i dozvoljene vrijednosti

| Ključ | UI label | Opis | Opcije za dropdown |
|---|---|---|---|
| `min_hours_before` | Najranija rezervacija | Koliko sati prije termina klijent može zakazati | 0, 1, 2, 3, 6, 12, 24 |
| `advance_booking_days` | Najdalja rezervacija | Koliko dana unaprijed klijent može zakazati | 7, 14, 30, 60, 90 |
| `cancellation_hours` | Besplatno otkazivanje | Do koliko sati prije termina klijent može otkazati | 0, 1, 2, 3, 6, 12, 24 |
| `break_between_min` | Pauza između termina | Minuta pauze nakon svakog termina (čišćenje, priprema) | 0, 5, 10, 15, 30 |

## Kako `break_between_min` utiče na availability

Kad je pauza > 0, availability engine tretira svaki postojeći termin kao da traje `duration + break_between_min`:

```ts
const effectiveEnd = addMinutes(appt.end, breakBetweenMin);
// overlap check koristi effectiveEnd umjesto appt.end
```

Primjer: Šminkanje 60min počinje u 17:00, break=10min. Termin efektivno zauzima 17:00–18:10. Sljedeći slobodan slot je 18:30 (jer 18:00 [18:00-19:00] overlaipuje sa [17:00-18:10]).

## Promjene u kodu

### 1. DB migracija + seed + RLS

Nova tabela `settings` sa 4 reda. Public read, authenticated full.

### 2. Helper modul `src/lib/settings/read.ts`

```ts
export type BookingSettings = {
  minHoursBefore: number;
  advanceBookingDays: number;
  cancellationHours: number;
  breakBetweenMin: number;
};

export async function readBookingSettings(sb): Promise<BookingSettings>
```

Čita iz `settings` tabele, parsira, fallback na `BOOKING_RULES` ako ključ nedostaje ili vrijednost nije validan broj.

### 3. `computeAvailableSlots` — prima `BookingSettings` umjesto da čita `BOOKING_RULES`

Novi opcioni parametar `settings?: BookingSettings`. Ako proslijeđen, koristi umjesto `BOOKING_RULES`. Backward-compatible.

Konkretne promjene u petlji:
- `min_hours_before` → čita iz `settings.minHoursBefore` (već imamo `skipMinHoursBefore` za admin — ostaje)
- `advance_booking_days` → čita iz `settings.advanceBookingDays`
- **break_between_min** → novi: `allBlocking` array mapira `end` u `end + breakBetweenMin` prije overlap check-a

### 4. `/api/availability` route — čita settings iz baze

Dodaje peti parallel query za `settings`, prosljeđuje u `computeAvailableSlots`.

### 5. Admin UI — nova sekcija "Pravila rezervisanja" u `/admin/postavke`

4 dropdown-a sa fiksnim opcijama (ne slobodni input — ista logika kao duration_min dropdown). Server action čita FormData i update-uje `settings` tabelu.

### 6. `/zakazi/uspjesno` stranica — čita `cancellation_hours` iz baze

Trenutno prikazuje hardkodovani tekst "24h za besplatno otkazivanje". Treba čitati iz settings.

## Testing

- 3 nova unit testa za `break_between_min` u availability.test.ts
- 1 novi unit test za `readBookingSettings` fallback
- Existing testovi ostaju jer koriste default `BOOKING_RULES` (fallback)

## Out of scope

- Per-service break_between_min (svi servisi dijele istu pauzu)
- Per-service min_hours_before
- Weekday/weekend radno vrijeme (već konfigurisano kroz `working_hours` tabelu)
- UI za dodavanje custom ključeva u settings (hardkodovano 4 ključa)
