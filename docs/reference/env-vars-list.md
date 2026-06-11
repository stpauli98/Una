# Reference: Sve environment varijable

Kompletna lista svih env vars + sample vrijednosti.

## Production (Vercel)

### Supabase

```bash
# Public URL — eksponira se klijentu
NEXT_PUBLIC_SUPABASE_URL=https://ljxggwpzljtjeeljtqts.supabase.co

# Public anon key — eksponira se klijentu, sigurno preko RLS
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key — TAJAN, samo server
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Site

```bash
NEXT_PUBLIC_SITE_URL=https://upmakeup.ba
```

Koristi se za:
- Canonical URL-ovi
- OG image URL-ovi
- Sitemap entries
- JSON-LD strukturirani podaci

### Upstash Redis (rate limiting)

```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### VAPID (push notifikacije, admin only)

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHi...   # Klijent treba za subscribe
VAPID_PRIVATE_KEY=...                  # TAJAN, server only
VAPID_SUBJECT=mailto:peranovicuna6@gmail.com
```

### Optional

```bash
# Dodatni admin email-ovi (comma-separated)
ADMIN_EMAILS_EXTRA=test@admin.com,other@example.com

# Resend (email notifikacije — implementirano, aktivira se setovanjem key-a;
# bez key-a se email-ovi tiho preskaču, app radi normalno)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=rezervacije@upmakeup.ba

# Na koju adresu stižu admin notifikacije o novim rezervacijama
ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com
```

## Development (`.env.local`)

```bash
# Produkcioni Supabase (za lokalni dev sa pravim podacima)
NEXT_PUBLIC_SUPABASE_URL=https://ljxggwpzljtjeeljtqts.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Za CLI komande
SUPABASE_ACCESS_TOKEN=sbp_...
```

## Test (`.env.test` — auto-generated)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...demo...
SUPABASE_SERVICE_ROLE_KEY=eyJ...demo...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# E2E test
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_SERVICE_ROLE_KEY=eyJ...demo...
E2E_ADMIN_EMAIL=test@admin.com
E2E_ADMIN_PASSWORD=Test1234A
ADMIN_EMAILS_EXTRA=test@admin.com
```

Playwright dodatno čita (opciono, postavlja ih CI/skripte — ne idu u .env fajlove):

| Var | Svrha |
|-----|-------|
| `PLAYWRIGHT_BASE_URL` | Override base URL (default `http://localhost:3000`) |
| `PLAYWRIGHT_SKIP_WEB_SERVER` | Ne diži dev server (već radi — koristi `run-pwa-e2e.sh`) |
| `DOTENV_CONFIG_PATH` | Koji env fajl Playwright config učitava |
| `CI` | Aktivira CI mode (retries, workers) |

## NEXT_PUBLIC_* prefix

Next.js eksponira env vars sa `NEXT_PUBLIC_` prefix-om klijentu:

| Var | Prefix | Eksponirana |
|-----|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Da | Klijent zna |
| `SUPABASE_SERVICE_ROLE_KEY` | Ne | Server only |

**NIKAD** ne stavljaj tajnu vrijednost sa `NEXT_PUBLIC_*` prefiks-om!

## Verifikacija

### Lokalno

```bash
cat .env.local
```

### Vercel (CLI)

```bash
vercel env ls production
vercel env ls preview
vercel env ls development
```

### Vercel (Dashboard)

Project → Settings → Environment Variables → vidi sve.

## Rotation strategy

| Var | Rotirati kada | Kako |
|-----|----------------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Pri sumnji da je leaked | Supabase Dashboard → API → Generate new |
| `UPSTASH_REDIS_REST_TOKEN` | Pri sumnji | Upstash Console → Regenerate |
| `VAPID_PRIVATE_KEY` | Pri sumnji | `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_*` | Rijetko | Promjena ne ugrožava security |

Nakon rotacije: update Vercel env + redeploy.

## Sample fajl

`.env.example` (u repo-u):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Site
NEXT_PUBLIC_SITE_URL=

# Rate limiting (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Push (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:peranovicuna6@gmail.com

# Admin
ADMIN_EMAILS_EXTRA=

# Email (TBD Phase 8)
RESEND_API_KEY=
RESEND_FROM_EMAIL=rezervacije@upmakeup.ba
ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com
```

Klonira → popuniš → spreman.

## .gitignore

`.env*` u `.gitignore`:

```
.env*
!.env.example
```

`.env.example` ostaje u git-u. `.env.local`, `.env.test` nikad.
