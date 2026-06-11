# Supabase produkcija

## Project info

| Polje | Vrijednost |
|-------|-----------|
| Project name | UP Beauty |
| Project ID | `ljxggwpzljtjeeljtqts` |
| URL | `https://ljxggwpzljtjeeljtqts.supabase.co` |
| Region | Central EU (Frankfurt) |
| Tier | Free |
| Postgres version | 17.x |
| Database name | `postgres` |

Dashboard: https://supabase.com/dashboard/project/ljxggwpzljtjeeljtqts

## Komponente

### Database

PostgreSQL 17 — full SQL + extensions.

### Auth

Email + password. Detalji: [../security/auth.md](../security/auth.md)

### Storage

| Bucket | Public | Use |
|--------|--------|-----|
| `gallery` | Da | Slike u galeriji |
| `services` | Da | Slike usluga (TBD use) |

Konfigurisano kroz `supabase/seed.sql` (lokalno) i Dashboard (produkcija).

### Realtime

Aktiviran za:
- `appointments` tabelu (`ALTER PUBLICATION supabase_realtime ADD TABLE appointments`)

Migracija: `20260518000000_realtime_appointments.sql`

### Edge Functions

Trenutno ne koristimo (sve kroz Vercel server actions).

## API endpoints

| Endpoint | Use |
|----------|-----|
| `https://<project>.supabase.co/auth/v1/*` | Auth (login, refresh) |
| `https://<project>.supabase.co/rest/v1/*` | PostgREST API (poštuje RLS) |
| `https://<project>.supabase.co/storage/v1/object/public/*` | Public file URL |
| `https://<project>.supabase.co/realtime/v1/*` | WebSocket Realtime |

## Pristup

### Klijent — Anon key

```typescript
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Eksponiran klijentu. Sigurnost dolazi iz RLS politika.

### Server — Service role key

```typescript
SUPABASE_SERVICE_ROLE_KEY=eyJ...  // TAJAN!
```

Server-only. Zaobilazi RLS. Koristi se za:
- Race guard u booking-u
- Availability API (čita sve termine kroz RLS bypass)
- Admin actions koje trebaju cross-user pristup

**Nikad ne smije biti eksponiran klijentu.**

### Admin user (Una)

Login kroz `/admin/login`. JWT se generiše per session.

### CLI access (developer)

Personal access token (`SUPABASE_ACCESS_TOKEN`):

```bash
supabase link --project-ref ljxggwpzljtjeeljtqts
supabase db push --linked
supabase migration list --linked
```

## Backups

| Tier | Backup frequency | Retention |
|------|------------------|-----------|
| Free | Daily | 7 dana |
| Pro | Daily | 30 dana + PITR |

Manual:

```bash
supabase db dump --linked > backup.sql
```

## Performance

| Resource | Free limit |
|----------|------------|
| Database size | 500 MB |
| Storage | 1 GB |
| Bandwidth | 5 GB/mj |
| Realtime concurrent | 200 |
| Auth users | 50,000 |
| Edge Function invocations | 500,000/mj |

UP Makeup je daleko ispod svih limita (sa 132 termina, ukupno < 1 MB).

## Monitoring

Dashboard → Logs:
- Query Logs (slow queries)
- Auth Logs (login attempts)
- Storage Logs (uploads, downloads)
- Realtime Logs (subscriptions)

Dashboard → Database → Performance:
- Top queries by duration
- Cache hit rate
- Connection count

## Database extensions

Aktivirano:

| Extension | Use |
|-----------|-----|
| `btree_gist` | EXCLUDE USING gist za `no_overlapping_appointments` |
| `pgcrypto` | (Standard) za `gen_random_uuid()` |

Provjeriti: Dashboard → Database → Extensions.

## RLS

**Sve tabele imaju RLS uključen.**

Provjerit: Dashboard → Authentication → Policies → svaka tabela ima zelenu RLS oznaku.

Detalji: [../security/rls-policies.md](../security/rls-policies.md)

## Connection management

Supabase Free tier: max 60 direct DB connections.

Vercel serverless: svaki function invocation može otvoriti connection. Sa 60 limit-om, ako se uglavi može doći do "max connections" error.

**Mitigation:** Supabase pooler (PgBouncer) — dijeli connection pool.

```
Direct: postgres://...@db.<project>.supabase.co:5432/postgres  (60 connection limit)
Pooler: postgres://...@db.<project>.supabase.co:6543/postgres  (transparent pooling)
```

Supabase JS klijent automatski koristi pooler. Bez ručne konfiguracije.

## Migration sync

Lokalne migracije u `supabase/migrations/` ↔ remote migration history.

```bash
supabase migration list --linked
```

Ako su out of sync:

```bash
supabase migration repair --status applied <version> --linked
supabase migration repair --status reverted <version> --linked
```

Detalji: [migrations.md](./migrations.md)

## Logs retention

| Log type | Free tier |
|----------|-----------|
| Query logs | 7 dana |
| Auth logs | 7 dana |
| Storage logs | 7 dana |

Za dugoročno, eksportuj kroz API ili integrate sa external SIEM.

## Disaster recovery

### Scenarij: Cijeli projekat obrisan

1. Re-kreirati projekat sa istim region-om (Frankfurt)
2. Restore from backup (SQL dump)
3. Re-create storage buckets
4. Re-upload slike (možda iz neke arhive)
5. Update env vars u Vercel-u
6. Redeploy

Ne lijepo, ali izvedivo.

### Scenarij: Tabela obrisana ili korumpirana

1. Restore from daily backup (Dashboard → Settings → Backups)
2. Apply lost transactions manually (ako su <1 dan)

### Scenarij: User error (DELETE bez WHERE)

1. PITR (Pro tier) za <1 dan ranije
2. Ili full restore + lost data

## Sledeće

- [migrations.md](./migrations.md) — migration management
- [../security/rls-policies.md](../security/rls-policies.md) — RLS politike
