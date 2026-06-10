# Migration management

Kako primijeniti, revertovati i sync-ovati SQL migracije.

## Direktorij

```
supabase/migrations/
├── 20260409100000_init_schema.sql
├── 20260409100100_rls_policies.sql
├── 20260409100200_seed_data.sql
├── 20260409120000_time_blocks.sql
├── 20260410_settings.sql
├── 20260411100000_no_overlapping.sql
├── 20260411100001_confirmation_token.sql
├── 20260422_tighten_rls.sql
├── 20260427000000_time_blocks_public_view.sql
├── 20260427000001_storage_policies.sql
├── 20260428000000_optional_service_price.sql
├── 20260504100000_service_image.sql
├── 20260518000000_realtime_appointments.sql
├── 20260518000001_push_subscriptions.sql
├── 20260520000000_appointments_price_snapshot.sql
├── 20260524100000_time_blocks_recurrence.sql
├── 20260526200000_email_tracking_columns.sql
└── 20260527000000_security_hardening.sql
```

Naming convention: `YYYYMMDDHHMMSS_descriptive_name.sql`

## Setup

### Setup access token

```bash
# Generiši na https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_...
```

### Link project

```bash
supabase link --project-ref ljxggwpzljtjeeljtqts
```

Jednom per machine.

## Komande

### List migration history

```bash
supabase migration list --linked
```

Output:

```
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260409100000 | 20260409100000 | 2026-04-09 10:00:00
   20260409100100 | 20260409100100 | 2026-04-09 10:01:00
   ...
   20260527000000 | 20260527000000 | 2026-05-27 00:00:00
```

| Local i remote isti | Sync |
| Samo local | Treba push |
| Samo remote | Treba pull ili repair (status reverted u kodu) |

### Apply migracije (push)

```bash
supabase db push --linked
```

Promptuje za confirmation:

```
Do you want to push these migrations to the remote database?
 • 20260601100000_new_feature.sql

 [Y/n]
```

Yes → izvršava SQL na produkciji.

### Force push (skip prompts)

```bash
supabase db push --linked --include-all
```

Korisno za CI ili kad si siguran. **Pažljivo na produkciji.**

### Repair migration history

Ako su out of sync (npr. fajl na disk-u, nije pokrenut na remote):

```bash
supabase migration repair --status applied <version> --linked
```

Označava kao "applied" bez izvršavanja (jer već si izvršio ručno ili kroz drugi path).

```bash
supabase migration repair --status reverted <version> --linked
```

Označava kao "reverted" (jer fajl je obrisan iz lokalnih ili je remote ostao iz testne migracije).

### Generate types

Nakon migracija → generiše TypeScript tipove:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Tipovi auto-update. Sad TypeScript zna o novim kolonama.

Commit tipove u git (`src/types/database.ts`).

## Workflow — nova migracija

### 1. Kreiraj fajl

```bash
# Format: YYYYMMDDHHMMSS_naziv.sql
echo "" > supabase/migrations/$(date +%Y%m%d%H%M%S)_add_loyalty_field.sql
```

### 2. Napiši SQL

```sql
-- supabase/migrations/20260615120000_add_loyalty_field.sql

ALTER TABLE customers
  ADD COLUMN loyalty_points INTEGER DEFAULT 0 NOT NULL;
```

### 3. Test lokalno (Docker)

```bash
supabase db reset  # Wipe lokalnu bazu, apply sve migracije
# ili:
supabase migration up
```

### 4. Provjeri kroz Studio

http://localhost:54323 → Tables → vidi novu kolonu.

### 5. Generiši tipove

```bash
supabase gen types typescript --local > src/types/database.ts
```

### 6. Update aplikativni kod

Koristi novu kolonu u TypeScript-u.

### 7. Test (unit, e2e)

```bash
npm test
npm run test:e2e:local
```

### 8. Commit i push

```bash
git add supabase/migrations/20260615120000_add_loyalty_field.sql
git add src/types/database.ts
git add src/...  # aplikativni kod
git commit -m "feat: add loyalty points to customers"
git push
```

### 9. Apply na produkciju

```bash
supabase db push --linked
```

### 10. Deploy (auto kroz Vercel)

Git push trigeruje Vercel deploy. Kod već koristi nove tipove i kolonu.

## Idempotency

Sve migracije treba da budu **idempotentne** — mogu se izvršiti više puta bez side effects:

```sql
-- Good
ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar TEXT;
CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo(bar);
CREATE OR REPLACE FUNCTION ...

-- Bad
ALTER TABLE foo ADD COLUMN bar TEXT;  -- Error ako vec postoji
CREATE INDEX idx_foo_bar ON foo(bar);  -- Error
```

### DROP IF EXISTS pre CREATE

```sql
DROP POLICY IF EXISTS "old policy name" ON foo;
CREATE POLICY "new policy name" ON foo ...;
```

### Wrapped u DO block (za conditional)

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'foo policy') THEN
    CREATE POLICY "foo policy" ON foo ...;
  END IF;
END $$;
```

## Rollback

Supabase ne podržava native rollback per migration. Za reverse:

### Opcija 1: Forward migration

Napiši novu migraciju koja undo-uje:

```sql
-- 20260616000000_remove_loyalty_field.sql
ALTER TABLE customers DROP COLUMN loyalty_points;
```

### Opcija 2: PITR (Pro tier)

Point-in-time recovery → restore na vrijeme prije migracije. Gubiš sve transakcije nakon.

### Opcija 3: Manual SQL

Pokreni SQL kroz Dashboard → SQL Editor:

```sql
ALTER TABLE customers DROP COLUMN loyalty_points;
```

Zatim repair:

```bash
supabase migration repair --status reverted 20260615120000 --linked
```

## Edge cases

### Out-of-sync migration history

Lokalno fali, remote ima:

```bash
supabase migration repair --status reverted <ver> --linked
```

Lokalno ima, remote nema:

```bash
supabase db push --linked
```

Lokalno i remote oba imaju, ali sa različitim sadrzajem (different timestamps):

Ne podržano. Treba ručno rebase ili rewrite.

### Migration sa exclusion constraint koji već postoji

Ako recreate-uje constraint koji već postoji:

```sql
ALTER TABLE foo DROP CONSTRAINT IF EXISTS bar;
ALTER TABLE foo ADD CONSTRAINT bar EXCLUDE USING gist (...);
```

### Migration koja referira na podatak

Nemoj. Migracije su za schema, ne za podatke.

Za seed data: `supabase/seed.sql` (samo lokalno).

Za produkcijski data: pokreni jednokratno kroz SQL Editor (ne kroz migraciju).

## Production deployment workflow

```
1. Local: napiši + test migraciju
2. Local: npm test + npm run build
3. Git push origin main
4. Vercel auto-deploy
5. supabase db push --linked  (manual!)
6. Provjeri Vercel deploy + Supabase Dashboard
```

**Pažljivo:** Vercel deploy ne triggeruje DB migration. Treba ručno `supabase db push --linked` prije ili poslije Vercel deploy-a, zavisno od da li nove kolone su required za novi kod.

Bolji pattern: Migration prvo (kompatibilan sa starim kodom), pa kod (koristi nove kolone).

## Backup before risky migration

```bash
supabase db dump --linked > backup-pre-migration-$(date +%Y%m%d).sql
```

## CI integration (TBD)

Mogli bismo integrate `supabase db push` u GitHub Actions:

```yaml
- name: Apply migrations
  run: supabase db push --linked
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Trade-off: riskantno (bilo koji PR može modifikovati produkciju). Trenutno: manual.

## Sledeće

- [../reference/migrations-list.md](../reference/migrations-list.md) — istorijat svih migracija sa opisima
- [../security/rls-policies.md](../security/rls-policies.md) — RLS migracije
