# Environment variables

Sve env varijable koje sajt koristi, gdje se setuju i šta rade.

## Locations

| Where | Što sadrži |
|-------|-----------|
| Vercel Dashboard → Settings → Environment Variables | Production + Preview |
| `.env.local` (lokalno, NIJE u git-u) | Developer local override |
| `.env.test` (lokalno, NIJE u git-u) | Generisana od `test:setup` skripte |
| `.env.example` (u git-u) | Template, dokumentuje sve vars |

## Required za produkciju

### Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ljxggwpzljtjeeljtqts.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Public, eksponira se klijentu
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # TAJAN! Server only
```

| Var | Eksponira | Šta radi |
|-----|-----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Da | Klijent zna gdje je Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Da | Anon pristup sa RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Ne** | Bypass RLS (server only) |

### Site URL

```bash
NEXT_PUBLIC_SITE_URL=https://upmakeup.ba
```

Koristi se za:
- Canonical URL-ovi (`<link rel="canonical">`)
- OG image URL-ovi (`og:image`)
- Sitemap entries (`<loc>https://upmakeup.ba/...</loc>`)
- robots.txt sitemap URL
- JSON-LD `@id`, `url` polja

Ako je localhost ili nedef. → admin dashboard prikazuje warning.

### Rate limiting

```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

Ako nisu postavljene → fallback na in-memory (radi ali ne distribuirano).

### Push notifications

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...     # Public, klijent treba za subscribe
VAPID_PRIVATE_KEY=...                  # TAJAN! Server only
VAPID_SUBJECT=mailto:peranovicuna6@gmail.com
```

Ako nisu postavljene → push se ne salje (nema crash, samo no-op).

## Optional

### Email (Resend)

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=rezervacije@upmakeup.ba
```

Trenutno **se ne koristi**. Postavljeno za buduće Phase 8 email integraciju.

### Admin emails extra

```bash
ADMIN_EMAILS_EXTRA=test@admin.com
```

Comma-separated. Dodaje se na ADMIN_EMAILS set. Koristi za E2E testne admin user-e.

### Admin notification email

```bash
ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com
```

Trenutno **se ne koristi**. Postavljeno za buduće.

### Supabase access token (CLI)

```bash
SUPABASE_ACCESS_TOKEN=sbp_...
```

Personal access token za `supabase` CLI komande. **Ne za production server.** Samo lokalno za developer commands.

## E2E test vars

`.env.test` (generisana automatski):

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

Generiše `scripts/setup-test-env.sh`. Detalji: [../testing/docker-setup.md](../testing/docker-setup.md)

## Setup checklist po environmentu

### Lokalni development

1. `cp .env.example .env.local`
2. Popuniti production Supabase keys (ili pokrenuti Docker Supabase i koristiti `.env.test`)
3. `npm run dev`

### Vercel production

Dashboard → Settings → Environment Variables → dodati:

| Var | Source |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Isto |
| `SUPABASE_SERVICE_ROLE_KEY` | Isto |
| `NEXT_PUBLIC_SITE_URL` | `https://upmakeup.ba` |
| `UPSTASH_REDIS_REST_URL` | Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | Isto |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Generated locally |
| `VAPID_PRIVATE_KEY` | Isto |
| `VAPID_SUBJECT` | `mailto:peranovicuna6@gmail.com` |

Apply on: **Production** (or Preview if treba).

### Vercel preview (PR deployments)

Mogu se diferentiate (npr. Supabase staging projekt za PR-ove). TBD setup. Trenutno: ista env kao production.

## Verifikacija

```bash
# Lokalno
cat .env.local

# Vercel production (kroz CLI)
vercel env ls production
```

## Rotation strategy

### Supabase service role key

Promijeniti pri sumnji da je leaked:

1. Supabase Dashboard → Settings → API → "Generate new service_role key"
2. Update Vercel env var
3. Redeploy

### VAPID keys

Re-generišu se kroz npm script (TBD):

```bash
npx web-push generate-vapid-keys
```

Pri promjeni: svi postojeci push subscriptions postaju invalid. Una mora resubscribe.

### Upstash token

Console → Database → Settings → Regenerate token.

## Security best practices

- `.env*` u `.gitignore` (verified)
- Service role key never logged
- Service role key never in `NEXT_PUBLIC_*` prefix
- Vercel env vars encrypted at rest

## Šta NE smije nikad biti u env

- Plaintext password (koristi hash-ed kroz Supabase Auth)
- Database connection string sa password-om (koristi service role API)
- PII (lični podaci klijenata)

## Sledeće

- [vercel.md](./vercel.md) — kako postaviti env u Vercel-u
- [../testing/docker-setup.md](../testing/docker-setup.md) — lokalno test env
