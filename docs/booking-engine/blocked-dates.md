# Blokirani dani — `blocked_dates`

Cijeli dani blokirani — Una ne radi (godišnji odmor, praznik, renoviranje).

## Schema

```sql
CREATE TABLE blocked_dates (
  id BIGSERIAL PRIMARY KEY,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (date_to >= date_from)
);
```

## Razlika od `time_blocks`

| Aspekt | `blocked_dates` | `time_blocks` |
|--------|------------------|----------------|
| Granularnost | Cijeli dan | Pod-dan (start/end) |
| Use case | Godišnji odmor, praznici | Pauze, privatno |
| Tip kolone | `DATE` | `TIMESTAMPTZ` |
| Anon vidi `reason` | ✅ Da | ❌ Ne (samo kroz view) |

## Algoritam — kako se koristi

`computeAvailableSlots()` korak 3:

```typescript
for (const range of input.blocked) {
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  if (target >= from && target <= to) return [];
}
```

Ako bilo koji raspon overlap-uje sa ciljanim datumom → vrati prazno (cijeli dan blokiran).

## Use case primjeri

### "Godišnji odmor 1.7 - 15.7"

```sql
INSERT INTO blocked_dates (date_from, date_to, reason)
VALUES ('2026-07-01', '2026-07-15', 'Godišnji odmor');
```

Klijenti ne mogu rezervisati 1-15. juli.

### "Renoviranje 20.5"

```sql
INSERT INTO blocked_dates (date_from, date_to, reason)
VALUES ('2026-05-20', '2026-05-20', 'Renoviranje studija');
```

Jedan dan blokiran (`date_to = date_from`).

### "Praznik (Ramazanski bajram)"

```sql
INSERT INTO blocked_dates (date_from, date_to, reason)
VALUES ('2026-09-12', '2026-09-13', 'Bajram');
```

2 dana.

## Admin UI

`BlockedDatesManager` (`src/components/admin/BlockedDatesManager.tsx`)

### Forma za novi blok

| Polje | Tip | Validacija |
|-------|-----|-----------|
| Datum od | `<input type="date">` | Required, YYYY-MM-DD format |
| Datum do | `<input type="date">` | Required, `>= date_from` |
| Razlog | `<input type="text">` | Optional, max 200 char |

### Lista postojećih

Tabela:
- Datum od
- Datum do
- Razlog
- X dugme (delete)

## Server actions

**Fajl:** `src/app/admin/(protected)/postavke/actions.ts`

### `addBlockedDate(formData)`

```typescript
const blockedDateSchema = z
  .object({
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional().nullable(),
  })
  .refine((d) => d.date_to >= d.date_from, {
    message: "Datum kraja mora biti isti ili poslije datuma početka",
  });

INSERT INTO blocked_dates (...) VALUES (...)
```

### `removeBlockedDate(id)`

```sql
DELETE FROM blocked_dates WHERE id = $1
```

## RLS

```sql
-- Anon SELECT (vidi razlog) — manje privacy ali jednostavnije
CREATE POLICY "blocked_dates: public read" ON blocked_dates FOR SELECT TO anon, authenticated USING (true);

-- Admin full
CREATE POLICY "blocked_dates: admin full" ON blocked_dates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

**Privacy note:** `reason` polje je vidljivo anon korisnicima (kroz direkran query na Supabase). Razlog: pojednostavljenje (nema view kao kod `time_blocks`).

Ako je `reason` osjetljiv (npr. "ranjavanje"), bolje ostaviti prazno.

## UI feedback — kalendar

Na javnoj `/zakazi` stranici, blokirani dani su disabled u kalendaru (sivi, ne klikabilni). Una zna jer ih je sama unijela.

API ne vraća informaciju **zašto** je dan blokiran — samo da nema slotova.

## Edge cases

### Overlapping ranges

Una može unijeti više blokova koji se preklapaju. Algoritam to handle-uje — `if (target overlap any range) return []`.

### Past dates

Una može unijeti blok u prošlost. Nema validacije. Beskoristno ali nije bug.

### Multi-year range

`date_from = "2026-01-01"`, `date_to = "2030-12-31"` — radi, sve dane unutar blocked.

### Brisanje sa postojećim terminima

Brisanje block-a ne utiče na postojeće termine (jer block i appointment su nezavisne tabele). Ako Una briše block, novi rezervacije će biti dozvoljene unutar tog perioda.

## Test

`tests/unit/availability.test.ts`:
- Single date block → 0 slots
- Range block → 0 slots za sve dane u rasponu
- Range izvan ciljanog dana → ne utiče

## Sledeće

- [time-blocks.md](./time-blocks.md) — pod-dan blokade
- [../admin/postavke.md](../admin/postavke.md) — admin UI
