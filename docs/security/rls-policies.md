# RLS politike — Row-Level Security

Sve tabele imaju RLS uključen + politike za anon i authenticated.

## Princip

Postgres provjerava `USING` ili `WITH CHECK` clause za svaki SELECT/INSERT/UPDATE/DELETE.

```sql
ALTER TABLE foo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "...name..."
  ON foo
  FOR SELECT  -- ili INSERT/UPDATE/DELETE/ALL
  TO anon     -- ili authenticated
  USING (...condition for SELECT/UPDATE/DELETE...)
  WITH CHECK (...condition for INSERT/UPDATE...);
```

Ako nema politike za tu operaciju → operacija blokirana (default deny).

## Sve tabele — pregled

| Tabela | RLS | Anon SELECT | Anon INSERT | Admin |
|--------|-----|-------------|-------------|-------|
| `services` | ✅ | `active = true` | ❌ | Full |
| `appointments` | ✅ | ❌ | `status = 'ceka'` | Full |
| `gallery_images` | ✅ | Sve | ❌ | Full |
| `blocked_dates` | ✅ | Sve | ❌ | Full |
| `working_hours` | ✅ | Sve | ❌ | Full |
| `time_blocks` | ✅ | ❌ (kroz view) | ❌ | Full |
| `time_blocks_public` (view) | ✅ | Sve | ❌ | — |
| `settings` | ✅ | Sve | ❌ | Full |
| `training_inquiries` | ✅ | ❌ | `status = 'novi'` | Full |
| `push_subscriptions` | ✅ | ❌ | ❌ | Full |

## Trenutne politike (nakon `20260527000000_security_hardening.sql`)

### `services`

```sql
CREATE POLICY "services: anon read active"
  ON services FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "services: admin full"
  ON services FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

Anon vidi samo aktivne usluge. Admin može sve.

### `appointments`

```sql
CREATE POLICY "appointments: anon insert"
  ON appointments FOR INSERT TO anon
  WITH CHECK (status = 'ceka' AND confirmation_sent_at IS NULL);

CREATE POLICY "appointments: admin full"
  ON appointments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

**Nema anon SELECT.** Klijenti ne mogu listati termine.

**Anon INSERT ograničen:**
- `status = 'ceka'` — anon ne može sam sebe staviti u `potvrdjen`
- `confirmation_sent_at IS NULL` — anon ne može fake-ovati timestamp

### `gallery_images`

```sql
CREATE POLICY "gallery_images: public read"
  ON gallery_images FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "gallery_images: admin write"
  ON gallery_images FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "gallery_images: admin update"
  ON gallery_images FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "gallery_images: admin delete"
  ON gallery_images FOR DELETE TO authenticated USING (is_admin());
```

Svi vide slike. Samo admin može upload/edit/delete.

### `blocked_dates`, `working_hours`, `settings`

Slično — public read, admin full.

```sql
CREATE POLICY "blocked_dates: public read"
  ON blocked_dates FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "blocked_dates: admin full"
  ON blocked_dates FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Slično za working_hours i settings.
```

### `time_blocks` + view

```sql
-- Glavna tabela: SAMO admin
CREATE POLICY "time_blocks: admin full"
  ON time_blocks FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- View bez reason: anon read
CREATE VIEW time_blocks_public AS
  SELECT id, start_time, end_time FROM time_blocks;
-- View nasljeđuje RLS iz tabele... ali je `SECURITY DEFINER` ili
-- explicit policy required.
```

Anon SELECT-uje `time_blocks_public` umjesto `time_blocks` → ne vidi `reason`.

### `training_inquiries`

```sql
CREATE POLICY "training_inquiries: anon insert"
  ON training_inquiries FOR INSERT TO anon
  WITH CHECK (status = 'novi');

CREATE POLICY "training_inquiries: admin full"
  ON training_inquiries FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

Slično kao appointments, ali za upite za obuku.

**Note:** Trenutno se ne koristi (forma uklonjena, sve preko WhatsApp-a). Tabela ostaje u shemi za buduće.

### `push_subscriptions`

```sql
CREATE POLICY "push_subscriptions: admin full"
  ON push_subscriptions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

Samo admin može SELECT/INSERT/UPDATE/DELETE.

### Storage buckets

```sql
-- gallery bucket
CREATE POLICY "gallery: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');

CREATE POLICY "gallery: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND is_admin());

CREATE POLICY "gallery: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND is_admin())
  WITH CHECK (bucket_id = 'gallery' AND is_admin());

CREATE POLICY "gallery: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND is_admin());
```

Slično za `services` bucket.

## Kako tested

### Manual

Otvoriti Supabase Dashboard → Authentication → Policies → svaka tabela.

### Direkran API test (curl)

```bash
# Anon SELECT appointments → expect empty
curl "https://<project>.supabase.co/rest/v1/appointments?select=*" \
  -H "apikey: $ANON_KEY"
# → []

# Anon INSERT appointment sa status='potvrdjen' → expect denied
curl "https://<project>.supabase.co/rest/v1/appointments" \
  -X POST \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "potvrdjen", ...}'
# → 401 ili 403 (RLS violation)

# Anon INSERT sa status='ceka' → OK
curl ... -d '{"status": "ceka", ...}'
# → 201 Created
```

## Kako za debug

```sql
-- Provjeri jedan red kao anon
SET role anon;
SELECT * FROM appointments LIMIT 1;
-- Empty (anon nema SELECT politiku)

-- Promijeni nazad
RESET role;
```

Ili na Supabase Dashboard → SQL Editor → run kao "anon" role.

## Razlika u istoriji

### Original (`20260409100100_rls_policies.sql`)

Permissivne politike:
- Anon SELECT za sve (ne)
- `authenticated full access` za sve operacije

**Problem:** Ko god ima `authenticated` JWT (npr. self-registered preko Supabase Auth) → full admin pristup.

### Tighten (`20260422_tighten_rls.sql`)

Anon INSERT ograničen na `status = 'ceka'`. Ali `authenticated` je još imao full access.

### Security hardening (`20260527000000_security_hardening.sql`)

`authenticated` više nema implicit pristup. Sve admin politike koriste `is_admin()` check.

Sad je sigurno: samo `peranovicuna6@gmail.com` (i email iz `ADMIN_EMAILS_EXTRA`) može admin operacije.

## Pravi test

```sql
-- Login kao test korisnik (ne Una)
-- Pokusaj DELETE
DELETE FROM appointments WHERE id = 1;
-- → 0 rows affected (politika denies)

-- Login kao Una
-- Pokusaj DELETE
DELETE FROM appointments WHERE id = 1;
-- → 1 row affected (politika allows jer is_admin() = true)
```

## Sledeće

- [is-admin.md](./is-admin.md) — `is_admin()` funkcija detalje
- [auth.md](./auth.md) — kako se autentifikuje
