# Deployment — pregled

Sve što treba znati za deploy i održavanje produkcijske infrastrukture.

## Stack

```
┌──────────────────────────────────┐
│  Klijent (browser, telefon)      │
└──────────────┬───────────────────┘
               │ HTTPS
┌──────────────▼───────────────────┐
│  upmakeup.ba (DNS)               │
│  ns1/ns2.vercel-dns.com          │
└──────────────┬───────────────────┘
               │
┌──────────────▼───────────────────┐
│  Vercel CDN (edge)               │
│  - Static assets cache           │
│  - SSL termination               │
└──────────────┬───────────────────┘
               │
┌──────────────▼───────────────────┐
│  Vercel Serverless (Frankfurt)   │
│  - Next.js app                   │
│  - Server Actions                │
└──────────────┬───────────────────┘
               │
       ┌───────┴────────┬──────────┐
       │                │          │
┌──────▼──────┐  ┌──────▼─────┐  ┌─▼───────────┐
│  Supabase   │  │  Upstash   │  │  Resend     │
│ (Frankfurt) │  │   Redis    │  │ (opciono)   │
└─────────────┘  └────────────┘  └─────────────┘
```

## Komponente

| Komponenta | Provider | Tier | Region |
|-----------|----------|------|--------|
| Hosting | Vercel | Hobby | (Auto, multi) |
| Database | Supabase | Free | Frankfurt |
| Rate limit | Upstash Redis | Free | EU |
| Email (opciono) | Resend | Free (TBD) | — |
| Domain | Globalhost | — | BA |

## Fajlovi

| Tema | Fajl | Šta pokriva |
|------|------|-------------|
| Vercel deployment | [vercel.md](./vercel.md) | Project setup, env vars, deploy flow |
| Supabase produkcija | [supabase.md](./supabase.md) | Project info, RLS, backup |
| Domena | [domain.md](./domain.md) | upmakeup.ba DNS, nameservers |
| Environment variables | [env-vars.md](./env-vars.md) | Sve env vars sa opisom |
| Migracije | [migrations.md](./migrations.md) | Management migracija |

## Brzi reference

### Production URL

`https://upmakeup.ba`

### Production Supabase

- Project ID: `ljxggwpzljtjeeljtqts`
- URL: `https://ljxggwpzljtjeeljtqts.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/ljxggwpzljtjeeljtqts

### Vercel project

- Name: `up-beauty`
- Project ID: `prj_BnH8DsoOasDcxqepIoa45T7gyVJj`
- Dashboard: https://vercel.com/stpauli98s-projects/up-beauty

### Repo

GitHub: https://github.com/stpauli98/Una

Branch:
- `main` → produkcija (auto-deploy)
- `feature/*` → preview deploys

## Deploy flow

```
1. git push origin main
2. Vercel detektuje push (GitHub webhook)
3. Vercel build:
   - npm install (lock fajl)
   - npm run build
   - Generiše statične + ISR + dynamic rute
4. Vercel deploy na CDN
5. Production URL aktivna (~1-2 min)
```

**Bez ručnih akcija** — sve auto.

## Rollback

Ako deploy padne:

1. Vercel Dashboard → Deployments
2. Nadji prethodni successful deploy
3. "Promote to production"
4. Vercel revert za <30s

Ili: git revert na main, force push.

## Monitoring

| Šta pratiti | Gdje |
|-------------|------|
| Build status | Vercel Dashboard → Deployments |
| Runtime errors | Vercel Dashboard → Functions → logs |
| Supabase queries | Supabase Dashboard → Logs → Query Logs |
| Supabase Auth events | Supabase Dashboard → Logs → Auth Logs |
| Slow queries | Supabase Dashboard → Database → Performance |

Nema centralizovanog monitoring tool-a trenutno (Sentry/Datadog) — može se dodati ako treba.

## Backups

### Supabase

- Daily automated backup (Free tier: 7 dana retention)
- Pro tier: do 30 dana + PITR (Point In Time Recovery)

Manual backup:

```bash
supabase db dump --linked > backup-$(date +%Y%m%d).sql
```

### Code

GitHub je naš backup. Repo je private, ali stpauli98 ima pristup.

### Slike (Storage)

Nema automatskog backup-a. Mogli bismo periodicno mirror-ovati na drugu lokaciju ali trenutno nije implementirano.

Risk: ako Supabase Storage padne, slike izgubljene. Ali Supabase ima njihov interni backup — vrlo low risk.

## Cost

| Komponenta | Mjesečno | Pri kojem scale |
|-----------|----------|-----------------|
| Vercel Hobby | $0 | <100k requests |
| Supabase Free | $0 | <500MB DB, <1GB Storage |
| Upstash Free | $0 | <10k commands/day |
| Globalhost domain | ~$2 (24 KM/god ÷ 12) | Fixed |
| **Total** | **~$2/mj** | Trenutni scale |

Pri rastu:
- Vercel Pro: $20/mj (>1M requests)
- Supabase Pro: $25/mj (>500MB DB, >1GB Storage)
- Upstash Pro: $0.20 per million requests

UP Makeup vjerovatno ostaje na free tier-u dugo.

## Sledeće

- [vercel.md](./vercel.md) — Vercel specifičnosti
- [migrations.md](./migrations.md) — kako primijeniti DB migracije
