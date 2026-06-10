# Docker test setup

Lokalna Supabase instance za testove. Sve kroz jedan setup skript.

## Preduslovi

| Tool | Verzija | Install |
|------|---------|---------|
| Docker Desktop | Latest | https://docs.docker.com/desktop/ |
| Supabase CLI | v2.90+ | `brew install supabase/tap/supabase` |
| Node.js | 20.x | nvm ili oficijelni installer |

## Quick start

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty
npm run test:setup
```

Sve u jednoj komandi:
1. Pokrene Docker Supabase containerima
2. Sačeka da bude spreman
3. Ekstrahuje access keys
4. Generiše `.env.test` fajl
5. Kreira test admin user-a (`test@admin.com`)

Trajanje: ~30s prvi put (Docker pull), ~10s sledeci put.

## Šta se pokrene

Docker komponente:

| Container | Port | Šta |
|-----------|------|-----|
| `supabase_db_up-beauty` | 54322 | PostgreSQL 17 |
| `supabase_kong_up-beauty` | 54321 | API gateway |
| `supabase_studio_up-beauty` | 54323 | Studio UI |
| `supabase_inbucket_up-beauty` | 54324 | Email testing |
| `supabase_auth_up-beauty` | — | GoTrue auth |
| `supabase_storage_up-beauty` | — | Storage API |
| `supabase_realtime_up-beauty` | — | Realtime |
| `supabase_meta_up-beauty` | — | pg-meta |

Sve kroz `supabase start`.

## Generated `.env.test`

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...demo...
SUPABASE_SERVICE_ROLE_KEY=eyJ...demo...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_SERVICE_ROLE_KEY=eyJ...demo...
E2E_ADMIN_EMAIL=test@admin.com
E2E_ADMIN_PASSWORD=Test1234A
ADMIN_EMAILS_EXTRA=test@admin.com
```

## Stop

```bash
npm run supabase:stop
```

Zaustavlja sve containere. Backup je u Docker volume (data preživi restart).

## Reset (čisti DB)

```bash
supabase db reset
```

Wipe-uje sve podatke, apply-uje sve migracije nanovo.

## Korisni endpoints

| URL | Šta |
|-----|-----|
| http://127.0.0.1:54321 | API gateway |
| http://127.0.0.1:54322 | Postgres direktno |
| http://127.0.0.1:54323 | **Studio UI** (browse tables) |
| http://127.0.0.1:54324 | **Inbucket** (test emails) |

## Setup skripta

**Fajl:** `scripts/setup-test-env.sh`

Pseudo-kod:

```bash
# 1. Pokreni Supabase
supabase start

# 2. Sačekaj API
until curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null; do
  sleep 1
done

# 3. Ekstrahuj keys (CLI v2.90+ output format)
eval $(supabase status -o env)

# 4. Generiši .env.test
cat > .env.test << EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
...
EOF

# 5. Kreiraj test admin
curl -X POST $API_URL/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -d '{"email":"test@admin.com","password":"Test1234A","email_confirm":true}'
```

## Tipični problemi

### "Docker not running"

Pokreni Docker Desktop.

### "Port 54321 already in use"

Drugi proces koristi port:

```bash
lsof -i :54321
kill <PID>
```

Ili zaustavi prethodni Supabase:

```bash
supabase stop
```

### "Migration version not found"

Local fajlovi i remote nisu sinhronizovani:

```bash
supabase migration repair --status reverted <ver>
```

Ili: `supabase db reset` za clean start.

### "Storage bucket does not exist"

Storage bucket-i se kreiraju kroz `supabase/seed.sql` (lokalno). Restart Supabase:

```bash
supabase stop
supabase start
```

## Production vs Local — razlike

| Aspekt | Local | Production |
|--------|-------|------------|
| URL | http://127.0.0.1:54321 | https://...supabase.co |
| Region | macOS (local) | Frankfurt |
| Anon key | Demo (publicly known) | Project-specific |
| Service role | Demo | Project-specific |
| Email confirmation | Disabled | Disabled |
| Signup enabled | True (config.toml) | False (Dashboard override) |
| Realtime | Aktivan | Aktivan |

Lokalno **ne** koristi produkcione podatke. Nikad ne testirati protiv produkcije.

## `is_admin()` na local

Lokalno: hardkodirano `peranovicuna6@gmail.com`. Test admin `test@admin.com` **ne** prolazi `is_admin()`.

Za testove koji trebaju admin pristup, koristimo `service_role` key umjesto Una sesije:

```typescript
// tests/e2e/helpers.ts
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
// Bypasses RLS
```

Ili `proxy.ts` whitelist (`ADMIN_EMAILS_EXTRA=test@admin.com`) dozvoljava test useru `/admin/*` rute.

## Storage bucket

Lokalna kopija storage-a se cuva u Docker volume. Slike koje upload-uješ kroz lokalno admin: ne miješaju se sa produkcijom.

## Sledeće

- [unit-tests.md](./unit-tests.md) — Vitest setup
- [e2e-tests.md](./e2e-tests.md) — Playwright setup
