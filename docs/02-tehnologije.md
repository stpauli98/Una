# 02 · Tehnologije i dependencies

## Tech stack — high-level

| Sloj | Tehnologija | Verzija | Zašto |
|------|-------------|---------|-------|
| **Frontend framework** | Next.js | 16.x (App Router) | RSC, server actions, Turbopack |
| **UI library** | React | 19.x | Server Components, suspense |
| **Jezik** | TypeScript | 5.x | Strict mode |
| **Styling** | Tailwind CSS | v4 (`@theme`) | Bez `tailwind.config.ts` — sve u CSS |
| **Database** | Supabase (PostgreSQL 17) | hosted | RLS, Storage, Auth, Realtime |
| **Auth** | Supabase Auth | — | Email + password, JWT |
| **Hosting** | Vercel | — | CDN, edge, serverless functions |
| **Storage** | Supabase Storage | — | Galerija slike u `gallery` bucket-u |
| **Rate limiting** | Upstash Redis | — | Distribuirani limiter |
| **Image processing** | `sharp` | 0.34.x | Server-side WebP konverzija |
| **Image compression (client)** | `browser-image-compression` | 2.x | Compress before upload |
| **Phone validation** | `libphonenumber-js` | 1.x | BA + international |
| **Validation** | `zod` | 4.x | Schema validation |
| **Date utils** | `date-fns` + `date-fns-tz` | 4.x / 3.x | Bez moment-a |

## Production dependencies (lista)

Iz `package.json` (sortirano po grupama):

### Core framework
- `next@16.x` — Next.js framework
- `react@19.x` — React
- `react-dom@19.x` — React DOM

### Supabase
- `@supabase/supabase-js@2.x` — JS klijent
- `@supabase/ssr@0.10.x` — SSR helpers (server client, cookies)

### Validation & forms
- `zod@4.x` — schemas
- `libphonenumber-js@1.x` — telefon validacija

### Date & timezone
- `date-fns@4.x` — date utility funkcije
- `date-fns-tz@3.x` — timezone helpers (`fromZonedTime`)

### Image processing
- `sharp@0.34.x` — server-side image processing
- `browser-image-compression@2.x` — client-side compression

### UI utilities
- `lucide-react@1.x` — ikone
- `clsx@2.x` — conditional className-ovi
- `tailwind-merge@3.x` — Tailwind class merging

### Rate limiting
- `@upstash/ratelimit@2.x` — Ratelimit klasa
- `@upstash/redis@1.x` — Redis klijent

### Push notifications (admin PWA)
- `web-push@3.x` — VAPID push

### Email (opcional, instaliran ali se ne koristi)
- `resend@6.x` — Resend API klijent (Phase 8 TODO)

### Server-only safety
- `server-only@0.0.x` — kompajl error ako se import-uje na klijentu

## Dev dependencies (lista)

### Testing
- `vitest@4.x` — unit testovi
- `@vitejs/plugin-react@6.x` — React support
- `jsdom@29.x` — DOM environment
- `@testing-library/react@16.x` — React testing
- `@testing-library/jest-dom@6.x` — DOM matchers
- `@playwright/test@1.x` — E2E

### Build & lint
- `typescript@5.x` — TS compiler
- `eslint@9.x` — linting
- `eslint-config-next@16.x` — Next.js eslint rules
- `tailwindcss@4.x` — Tailwind CSS
- `@tailwindcss/postcss@4.x` — PostCSS plugin

### Types
- `@types/node@20.x`
- `@types/react@19.x`
- `@types/react-dom@19.x`

### Env loading
- `dotenv@17.x` — za Playwright `.env.test` loading

## Eksterni servisi

### Supabase (produkcija)

| Parametar | Vrijednost |
|-----------|------------|
| Project ID | `ljxggwpzljtjeeljtqts` |
| URL | `https://ljxggwpzljtjeeljtqts.supabase.co` |
| Region | Central EU (Frankfurt) |
| Plan | Free (može se nadograditi) |

Pristup: Supabase Dashboard → ulogovati se kao Una.

### Vercel

| Parametar | Vrijednost |
|-----------|------------|
| Project ID | `prj_BnH8DsoOasDcxqepIoa45T7gyVJj` |
| Project name | `up-beauty` |
| Custom domain | `upmakeup.ba` |
| Tier | Hobby (može se nadograditi) |

### Upstash Redis (rate limiting)

| Parametar | Vrijednost |
|-----------|------------|
| Service | Upstash Redis (REST) |
| Region | EU |
| Tier | Free (10K commands/day) |

Env vars:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Ako su prazne — sistem koristi in-memory fallback (resetuje se na cold start).

### Domena (upmakeup.ba)

| Parametar | Vrijednost |
|-----------|------------|
| Registrar | Globalhost (BiH reseller) |
| Nameservers | `ns1.vercel-dns.com`, `ns2.vercel-dns.com` |
| TLD registry | UTIC.NET.BA |

Vercel sam upravlja DNS-om (A + CNAME za www).

## Verzije pinned u CI

CI build (Vercel) koristi tačno ono što je u `package.json` + `package-lock.json`. Bez floating verzija.

## Upgrade strategija

| Komponenta | Strategija |
|-----------|-----------|
| **Next.js** | `npm install next@latest` — pažljivo, breaking changes između major verzija |
| **React** | Vezana za Next.js verziju |
| **Supabase paketi** | Manual upgrade, pratiti changelog |
| **Tailwind v4** | Beta još uvijek može imati BC |
| **`sharp`** | Pažljivo — različite verzije imaju različita ponašanja |
| **Tipovi (`@types/*`)** | Auto-update sa svakim `npm install` |

## Lock fajl

`package-lock.json` je committed u git. **Ne brisati i ne ignore-ovati**. Vercel build koristi tačne verzije iz lock fajla.

## Memory / build limiti

| Limit | Vrijednost | Gdje je definisan |
|-------|-----------|--------------------|
| Server actions body size | 10 MB | `next.config.ts` |
| Image upload max | 5 MB | `src/app/admin/(protected)/galerija/actions.ts` |
| Image max dimension | 4096 px | Isto |
| Gallery batch upload | 20 slika | `src/components/admin/GalleryManager.tsx` |
| Cache TTL (slike) | 30 dana | `next.config.ts` `images.minimumCacheTTL` |

## Build vs Runtime

| Šta | Build time | Runtime |
|-----|-----------|---------|
| Tipovi baze (`Database`) | ✅ Generisani prije builda | — |
| Sitemap | — | ISR (revalidate=300) |
| OG image | — | Generisana na zahtjev |
| Statične stranice (`/o-meni`, `/kontakt`...) | ✅ Pre-rendered | — |
| Dinamičke (`/zakazi`, `/galerija`) | — | ISR (revalidate=300) |
| Admin sve | — | `force-dynamic` |
| `/api/availability` | — | `force-dynamic` |

## TypeScript konfiguracija

Iz `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**Path alias** `@/*` mapira na `./src/*` — koristi se svuda za import (`import { foo } from "@/lib/foo"`).
