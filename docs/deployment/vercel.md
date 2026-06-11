# Vercel deployment

## Project info

| Polje | Vrijednost |
|-------|-----------|
| Project name | `up-beauty` |
| Project ID | `prj_BnH8DsoOasDcxqepIoa45T7gyVJj` |
| Framework | Next.js 16 |
| Build command | `npm run build` (auto-detected) |
| Output directory | `.next` (auto-detected) |
| Node version | 20.x (`engines` u package.json) |
| Region | Auto (multi) |

Dashboard: https://vercel.com/stpauli98s-projects/up-beauty

## Custom domain

`upmakeup.ba` → Vercel.

DNS: `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (Vercel managed).

Detalji: [domain.md](./domain.md)

## Env variables

Set kroz Dashboard → Settings → Environment Variables.

**Production:** sve env vars iz [env-vars.md](./env-vars.md).

**Preview / Development:** isto kao Production (ili kraći set za testne preview-e).

## Deploy flow

### Auto (git push)

```
git push origin main
  ↓
Vercel webhook
  ↓
Build (ENV vars iz Vercel)
  ↓
Deploy
  ↓
Production URL aktivna
```

Trajanje: 1-2 min.

### Manual (CLI)

```bash
npm i -g vercel
vercel login
vercel --prod
```

Rijetko koristim — preferiram git push.

### Preview deploys

Svaki PR (na non-main branch) → automatski preview deploy:
- URL kao `https://up-beauty-<hash>-stpauli98s-projects.vercel.app`
- Testno okruženje, ista env vars (osim ako preview-specific)

## Build settings

### `next.config.ts`

```typescript
export default {
  // Custom headers
  async headers() { ... },
  
  // Image optimization (Next 16: remotePatterns, NE deprecated `domains`)
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    qualities: [75, 90],              // q=90 otključan za portretne kadrove galerije
    dangerouslyAllowLocalIP: isDev,   // samo dev — lokalni Supabase je na 127.0.0.1:54321
    remotePatterns: [
      {
        protocol: "https",            // dev: http, izvedeno iz NEXT_PUBLIC_SUPABASE_URL
        hostname: supabaseHostname,   // <ref>.supabase.co
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};
```

### `tsconfig.json`

Strict mode, path alias `@/*`.

### `package.json`

```json
{
  "engines": { "node": ">=20.x" },
  "scripts": {
    "build": "next build",
    "start": "next start",
    "dev": "next dev"
  }
}
```

Vercel koristi `build` skripta. Locally: `npm run dev` za development.

## Routes — type

Vercel zna kako routirati svaki path zavisno od `dynamic` directive:

| Path | Tip | Reason |
|------|-----|--------|
| `/` | ISR (300s) | `export const revalidate = 300` |
| `/usluge` | ISR | Isto |
| `/galerija` | ISR | Isto |
| `/zakazi` | ISR | Isto |
| `/zakazi/uspjesno` | Dynamic | `force-dynamic` (čita confirmation_token) |
| `/api/availability` | Dynamic | `force-dynamic` (uvijek svježe) |
| `/admin/*` | Dynamic | `force-dynamic` |
| `/o-meni`, `/kontakt`, etc. | Static | Bez data fetcha |

## Edge runtime vs Node runtime

Trenutno: **sve Node runtime**.

Edge runtime je brži ali ima limitacije (`sharp` ne radi, no Node API-jevi). Zbog galerije image processing, držimo Node.

## Limits (Hobby tier)

| Resource | Hobby limit |
|----------|------------|
| Build duration | 45 min |
| Function duration | 10s |
| Function memory | 1024 MB |
| Function size | 50 MB compressed |
| Bandwidth | 100 GB/mj |
| Image transformations | 1000/mj |

UP Makeup je daleko ispod svih limita.

Ako se ikad pristupi limitu: upgrade na Pro ($20/mj).

## Logs

Vercel Dashboard → Project → Logs

| Log tip | Šta sadrži |
|---------|------------|
| Build | npm install, build output |
| Function | Server-side console.log + errors |
| Edge | CDN cache hits/misses |
| Static | Static file requests |

Retention: 1h za Hobby tier (24h za Pro, 7 dana za Enterprise).

Za dugoročno: integrate sa Datadog / Logtail (TBD).

## SSL

Vercel automatski generišu Let's Encrypt cert za custom domain.

| | |
|---|---|
| Issuer | Let's Encrypt |
| Validity | 90 dana (auto-renew) |
| HSTS | Da (Vercel auto) |
| Grade (SSL Labs) | A+ |

## Deploy hooks

Možemo trigger-ovati deploy kroz hook URL:

```bash
curl -X POST https://api.vercel.com/v1/integrations/deploy/$DEPLOY_HOOK_ID
```

Korisno za: cron-trigerovan deploy (npr. periodicni refresh slika).

Trenutno nema setup hooks.

## Aliases

`upmakeup.ba` → trenutni production deployment.

Vercel `up-beauty.vercel.app` → isto (default alias).

Možemo dodati staging.upmakeup.ba (TBD).

## Sledeće

- [env-vars.md](./env-vars.md) — kompletna lista env vars
- [domain.md](./domain.md) — DNS setup
