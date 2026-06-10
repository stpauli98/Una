# Reference: Sve migracije — istorijat

Hronologija svih SQL migracija u `supabase/migrations/`.

## Lista

| # | Datum | Fajl | Šta dodaje |
|---|-------|------|------------|
| 1 | 2026-04-09 | `20260409100000_init_schema.sql` | Početne tabele |
| 2 | 2026-04-09 | `20260409100100_rls_policies.sql` | Originalne RLS politike |
| 3 | 2026-04-09 | `20260409100200_seed_data.sql` | Seed services |
| 4 | 2026-04-09 | `20260409120000_time_blocks.sql` | `time_blocks` tabela |
| 5 | 2026-04-10 | `20260410_settings.sql` | `settings` key-value |
| 6 | 2026-04-11 | `20260411100000_no_overlapping.sql` | Exclusion constraint |
| 7 | 2026-04-11 | `20260411100001_confirmation_token.sql` | UUID anti-IDOR |
| 8 | 2026-04-22 | `20260422_tighten_rls.sql` | Anon INSERT ograničen |
| 9 | 2026-04-27 | `20260427000000_time_blocks_public_view.sql` | View bez reason |
| 10 | 2026-04-27 | `20260427000001_storage_policies.sql` | Storage RLS |
| 11 | 2026-04-28 | `20260428000000_optional_service_price.sql` | `variable_price`, `price_note` |
| 12 | 2026-05-04 | `20260504100000_service_image.sql` | Service slika |
| 13 | 2026-05-18 | `20260518000000_realtime_appointments.sql` | Realtime publication |
| 14 | 2026-05-18 | `20260518000001_push_subscriptions.sql` | Push tabela |
| 15 | 2026-05-20 | `20260520000000_appointments_price_snapshot.sql` | Snapshot cijene |
| 16 | 2026-05-24 | `20260524100000_time_blocks_recurrence.sql` | Recurrence group ID |
| 17 | 2026-05-26 | `20260526200000_email_tracking_columns.sql` | Email tracking |
| 18 | 2026-05-27 | `20260527000000_security_hardening.sql` | `is_admin()` + restrict RLS |

## Detalji per migracija

### 1. Init schema (`20260409100000_init_schema.sql`)

Početne tabele:
- `services` — katalog (id, name, category, price, duration_min, ...)
- `appointments` — rezervacije (id, service_id, client_*, start_time, end_time, status, ...)
- `blocked_dates` — cijeli blokirani dani
- `working_hours` — radno vrijeme per weekday (7 rows seed)
- `gallery_images` — slike galerije
- `training_inquiries` — upiti za obuku (sad nekoristen)
- `time_blocks` — pod-dan blokade

Plus indeksi za performanse.

### 2. RLS policies (`20260409100100_rls_policies.sql`)

Originalne politike — permisivne (`authenticated full access`). **Kasnije zamijenjene** u `20260527000000` security hardening.

### 3. Seed data (`20260409100200_seed_data.sql`)

Početne usluge:
- Šminkanje (svadbeno, večernje, maturalno, terensko)
- Pedikir (varijante)
- Trepavice 1:1
- Obuka

Plus working_hours seed (Mon-Fri 17-21, Sat-Sun 5-21).

### 4. Time blocks (`20260409120000_time_blocks.sql`)

Tabela za pod-dan blokade sa `start_time`, `end_time`, `reason`.

Plus indeksi.

### 5. Settings (`20260410_settings.sql`)

Key-value tabela. Seed defaults:
- `min_hours_before` = 24
- `advance_booking_days` = 90
- `cancellation_hours` = 24
- `break_between_min` = 0

### 6. No overlapping (`20260411100000_no_overlapping.sql`)

```sql
CREATE EXTENSION btree_gist;
ALTER TABLE appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (tstzrange(start_time, end_time) WITH &&)
  WHERE (status IN ('ceka', 'potvrdjen'));
```

DB-level race condition prevention.

### 7. Confirmation token (`20260411100001_confirmation_token.sql`)

```sql
ALTER TABLE appointments ADD COLUMN confirmation_token UUID;
CREATE UNIQUE INDEX idx_appointments_confirmation_token ...;
```

Anti-IDOR za success URL.

### 8. Tighten RLS (`20260422_tighten_rls.sql`)

Anon INSERT na appointments ograničen sa `WITH CHECK (status = 'ceka')`. Sprjecava self-confirm.

### 9. Time blocks public view (`20260427000000_time_blocks_public_view.sql`)

```sql
CREATE VIEW time_blocks_public AS
SELECT id, start_time, end_time FROM time_blocks;
```

Anon vidi samo public view, ne `reason`.

### 10. Storage policies (`20260427000001_storage_policies.sql`)

RLS za `storage.objects`:
- Public read za `gallery` i `services` bucket
- Admin only write (insert, update, delete)

### 11. Optional service price (`20260428000000_optional_service_price.sql`)

```sql
ALTER TABLE services
  ADD COLUMN variable_price BOOLEAN DEFAULT false,
  ADD COLUMN price_note TEXT,
  ADD COLUMN duration_note TEXT;
```

Omogućava "cijena na upit" i "trajanje po dogovoru".

### 12. Service image (`20260504100000_service_image.sql`)

```sql
ALTER TABLE services ADD COLUMN image_path TEXT;
```

Plus `services` storage bucket.

### 13. Realtime appointments (`20260518000000_realtime_appointments.sql`)

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
```

Omogućava live updates u admin panelu.

### 14. Push subscriptions (`20260518000001_push_subscriptions.sql`)

Tabela za Web Push subscriptions. RLS samo admin.

### 15. Appointments price snapshot (`20260520000000_appointments_price_snapshot.sql`)

```sql
ALTER TABLE appointments ADD COLUMN price_snapshot INTEGER;
```

Snimaj cijenu pri kreiranju termina. Sprjecava promjenu cijene retro.

### 16. Time blocks recurrence (`20260524100000_time_blocks_recurrence.sql`)

```sql
ALTER TABLE time_blocks ADD COLUMN recurrence_group_id UUID;
```

Priprema za recurrent blokade (UI još nije). Postojeci rows ostaju `NULL` = jednokratni.

### 17. Email tracking (`20260526200000_email_tracking_columns.sql`)

```sql
ALTER TABLE appointments
  ADD COLUMN email_received_sent_at TIMESTAMPTZ,
  ADD COLUMN email_confirmed_sent_at TIMESTAMPTZ,
  ADD COLUMN email_cancelled_sent_at TIMESTAMPTZ;
```

Priprema za Phase 8 email integraciju. Trenutno se ne koriste.

### 18. Security hardening (`20260527000000_security_hardening.sql`)

**Najveća security migracija.**

1. Kreira `is_admin()` Postgres funkciju (provjerava JWT email)
2. Drop svih old `authenticated full access` politika
3. Create new admin-only politike za sve tabele:
   - `services`: anon read active, admin full
   - `appointments`: anon insert (status=ceka), admin full
   - `gallery_images`: public read, admin write
   - `blocked_dates`, `working_hours`, `settings`: public read, admin full
   - `time_blocks`: admin only (view za anon)
   - `training_inquiries`: anon insert (status=novi), admin full
   - `push_subscriptions`: admin only
4. Storage policies za `gallery` i `services` bucket: admin only write

## Migration health check

```bash
supabase migration list --linked
```

Treba pokazati sve 18 sa `Local = Remote`.

Ako nije sync, vidi [../deployment/migrations.md](../deployment/migrations.md) za repair.

## Apply na novi environment

Lokalno (Docker):
```bash
supabase db reset  # Apply sve migracije nanovo
```

Produkcija:
```bash
supabase db push --linked
```

## Pravljenje nove migracije

```bash
# Format: YYYYMMDDHHMMSS_descriptive_name.sql
TIMESTAMP=$(date +%Y%m%d%H%M%S)
touch supabase/migrations/${TIMESTAMP}_my_new_feature.sql
```

Best practices: vidi [../deployment/migrations.md](../deployment/migrations.md).
