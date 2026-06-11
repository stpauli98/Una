# Time blocks — pod-dan blokade

**Tabela:** `time_blocks` + view `time_blocks_public`

Pod-dan blokade — Una blokira specifičan interval (pauza, privatno, kod zubara).

## Schema

```sql
CREATE TABLE time_blocks (
  id BIGSERIAL PRIMARY KEY,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  recurrence_group_id UUID,  -- weekly recurrence serijal (NULL = jednokratni)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);
```

## Anon view

```sql
CREATE VIEW time_blocks_public AS
SELECT id, start_time, end_time FROM time_blocks;
```

**Bez `reason`** — anon ne smije vidjeti privatne detalje.

RLS: anon SELECT na `time_blocks_public`. Direktan SELECT na `time_blocks` zahtjeva admin.

## Razlika od `appointments`

| Aspekt | `time_blocks` | `appointments` |
|--------|----------------|----------------|
| Klijent | Nema | Ime, telefon, email |
| Service ID | Nema | FK |
| Status | Nema (uvijek blocked) | ceka/potvrdjen/otkazan/zavrsen |
| Reason | Privatan (admin only) | Notes (klijent ostavlja) |
| Use case | Una blokira sebe | Klijent rezerviše |

## Korištenje u algoritmu

```typescript
// src/app/api/availability/route.ts
const { data: tbData } = await sb
  .from("time_blocks_public")  // ← view, ne tabela!
  .select("start_time, end_time")
  .lt("start_time", dayEnd)
  .gt("end_time", dayStart);

const slots = computeAvailableSlots({
  // ...
  blockedTimes: tbData.map(t => ({
    start: new Date(t.start_time),
    end: new Date(t.end_time),
  })),
});
```

Engine korak 7 — `blockedTimes` se kombinuje sa `existing` appointments-ima:

```typescript
const allBlocking = [...existing, ...(blockedTimes ?? [])];
const overlaps = allBlocking.some((item) => {
  const effectiveEnd = breakMin > 0 ? addMinutes(item.end, breakMin) : item.end;
  return cursor < effectiveEnd && end > item.start;
});
```

Tretira se identično kao postojeći termin za overlap check.

## Use case primjeri

### Pauza za ručak

```sql
INSERT INTO time_blocks (start_time, end_time, reason)
VALUES ('2026-06-15T13:00:00+02', '2026-06-15T14:00:00+02', 'Ručak');
```

13:00-14:00 nedostupno.

### Kod zubara

```sql
INSERT INTO time_blocks (start_time, end_time, reason)
VALUES ('2026-06-20T11:00:00+02', '2026-06-20T12:30:00+02', 'Stomatolog');
```

11:00-12:30 nedostupno.

### Privatno (anon ne vidi razlog)

Anon kroz `/api/availability`:
- Vidi da slot nije dostupan
- Ne vidi da je razlog "Stomatolog"

Anon direktnim querijem na Supabase:
- Može SELECT na `time_blocks_public` (bez `reason`)
- Ne može SELECT na `time_blocks` (RLS denies)

## Admin UI

`TimeBlocksManager` (`src/components/admin/TimeBlocksManager.tsx`)

### Forma

| Polje | Tip | Validacija |
|-------|-----|-----------|
| Datum | `<input name="block_date" type="date">` | Required |
| Od | `<select name="start_time_select">` | 30-min grid |
| Do | `<select name="end_time_select">` | 30-min grid |
| Razlog | `<input name="reason">` | Optional, max 200 |

### Konstruisanje timestamps

```typescript
const start = parseSarajevoDateTime(blockDate, startTimeSelect);
const end = parseSarajevoDateTime(blockDate, endTimeSelect);
```

`parseSarajevoDateTime` koristi Sarajevo TZ — `2026-06-15 13:00` postaje `13:00 CEST = 11:00 UTC`.

### Recurrence — sedmično ponavljanje (implementirano)

Una unese "Svaki ponedjeljak 13:00-14:00 do kraja godine" — checkbox **"Ponavlja se svake sedmice"** + "Do datuma" u `TimeBlocksManager`. Sistem generiše N pojedinačnih redova sa istim `recurrence_group_id` (UUID).

**Expansion logika:** `expandWeeklyTimeBlocks()` u `src/lib/utils/recurring-blocks.ts`:

- Svaka okurenca se računa kroz `parseSarajevoDateTime()` — DST-safe (blok "13:00" ostaje 13:00 i ljeti i zimi)
- `MAX_WEEKLY_OCCURRENCES = 260` (≈ 5 godina) — hard cap
- `maxUntilDateStr()` — "Do datuma" ograničen na danas + 366 dana

Unit testovi: `tests/unit/recurring-blocks.test.ts`.

## Server actions

### `createTimeBlock(formData)`

```typescript
const timeBlockSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  reason: z.string().max(200).optional().nullable(),
});

if (new Date(parsed.end_time) <= new Date(parsed.start_time)) {
  return { ok: false, error: "Kraj mora biti poslije početka" };
}

if (!isGridAligned(start) || !isGridAligned(end)) {
  return { ok: false, error: "Vrijeme mora biti na pun sat ili pola" };
}

INSERT INTO time_blocks (...) VALUES (...)
```

### `deleteTimeBlock(id)`

```sql
DELETE FROM time_blocks WHERE id = $1
```

Za blokove sa `recurrence_group_id` postoji i `deleteTimeBlockSeries(groupId)` server action — briše cijeli serijal odjednom. UI grupiše serijal i nudi obje opcije (jedan blok / cijeli serijal).

## Edge cases

### Off-grid time block

UI ne dozvoljava (dropdown sa grid vrijednostima). Server validira (`assertGridAligned`).

Ali ako bi se nekako dobio off-grid block (npr. 17:15-17:45):

```typescript
const slots = [17:00-18:00, 17:30-18:30, 18:00-19:00, ...];
// 17:15-17:45 overlap-uje sa 17:00-18:00 i 17:30-18:30 → oba blokirana
// 18:00-19:00 → OK
```

Off-grid block može blokirati više slotova nego namjeravano, ali algoritam je korektan.

### Multi-day block

```sql
INSERT (..., '2026-06-15T23:00+02', '2026-06-16T01:00+02', ...);
```

Block spans 2 dana. API query za `date=2026-06-15`:

```sql
WHERE start_time < '2026-06-16T00:00:00+02' AND end_time > '2026-06-15T00:00:00+02'
```

Block sa start=23:00, end=01:00 → matches obje dane.

### Block u prošlosti

Ne utiče na ništa. Beskoristno ali nije bug.

## RLS

```sql
-- Public view (anon vidi samo start/end)
CREATE POLICY "time_blocks_public: read" ON time_blocks_public FOR SELECT TO anon, authenticated USING (true);

-- Glavna tabela: samo admin
CREATE POLICY "time_blocks: admin full" ON time_blocks FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

## Migracije

| Migracija | Šta |
|-----------|-----|
| `20260409120000_time_blocks.sql` | Tabela kreirana |
| `20260427000000_time_blocks_public_view.sql` | View za anon |
| `20260524100000_time_blocks_recurrence.sql` | `recurrence_group_id` kolona |

## Test

E2E: `tests/e2e/time-blocks.spec.ts`, `tests/e2e/time-blocks-privacy.spec.ts`, `tests/e2e/admin-time-block.spec.ts`.
