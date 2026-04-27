# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Next.js 16 dev server (Turbopack, 0.0.0.0:3000)
npm run build        # Production build (includes typecheck)
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests (tests/unit/)
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright e2e (needs dev server running)
```

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 (`@theme` directive), Supabase (PostgreSQL + Auth + Storage + RLS), Vercel deployment.

**Language:** All UI text is in Serbian (Latin script). Variable/function names are English.

### Next.js 16 — `proxy.ts` replaces middleware

`src/proxy.ts` is the auth guard and session refresh layer. It runs on `/admin/:path*` routes only. There is no `middleware.ts`. Check `node_modules/next/dist/docs/` before using any Next.js API — this version has breaking changes from training data.

**API routes are NOT covered by the proxy.** New `/api/*` routes that need auth must call `requireAdmin()` (or check the session manually) inside the handler — see `src/app/api/availability/route.ts` for the pattern. The protected admin layout (`src/app/admin/(protected)/layout.tsx`) double-checks admin email as defense-in-depth, but it only fires when the request reaches a page route, not an API route.

### Two Supabase Clients

| Client | File | Key | RLS | Use for |
|--------|------|-----|-----|---------|
| Server | `src/lib/supabase/server.ts` | anon + cookies | Respects | RSC, route handlers, forms |
| Admin | `src/lib/supabase/admin.ts` | service role | Bypasses | Server actions that need cross-user data |

`admin.ts` has `"server-only"` import guard — never import from client components.

### Booking Availability Engine

`src/lib/booking/availability.ts` — Pure function `computeAvailableSlots(input)`.

- **Fixed 30-min grid** (`SLOT_INTERVAL_MIN = 30`). All times must be `:00` or `:30`.
- Grid alignment enforced server-side via `isGridAligned()` in `src/lib/utils/grid.ts`.
- Una = single operator. No `service_id` filter on appointments — ALL active appointments block ALL services.
- Settings (min_hours_before, advance_booking_days, etc.) read from `settings` table via `parseBookingSettings()` in `src/lib/settings/read.ts`, with fallback to `BOOKING_RULES` constants in `src/lib/constants/business.ts`.
- 127 unit tests cover this engine.

### Gallery Upload

Client compresses images to WebP via `browser-image-compression` (max 300KB, 1600px). Server re-validates and converts via `sharp` (accepts JPEG/PNG/WebP, outputs WebP). Images are uploaded **one at a time** (chunked) to avoid the 10MB body size limit. Max 20 per batch.

### Database

8 migrations in `supabase/migrations/`. Tables: `services`, `appointments`, `blocked_dates`, `working_hours`, `time_blocks`, `gallery_images`, `settings`, `training_inquiries`.

Regenerate types after schema changes:
```bash
supabase gen types typescript --local > src/types/database.ts
```

- `appointments` has an exclusion constraint (`no_overlapping_appointments`) preventing overlapping active bookings at the DB level.
- Latest migration (`20260422_tighten_rls.sql`) hardens RLS — public roles only get the columns they need. When debugging permission errors, diff against this file before assuming a code bug.
- For any DB uncertainty, query via the `supabase` MCP server first — don't guess schema.

### Key Patterns

- **Server actions** live in `actions.ts` files next to their page (e.g., `src/app/zakazi/actions.ts`).
- **Revalidation** uses `revalidatePath()` + `router.refresh()` for RSC data sync.
- **Rate limiting** via Upstash Redis sliding window in `src/lib/utils/rate-limit.ts` when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars are set; otherwise falls back to in-memory Map (dev/test). Async API: `await checkRateLimit(ip, limit, windowMs)`.
- **Success page** uses UUID `confirmation_token` (not sequential ID) to prevent IDOR.
- **Gallery lightbox** renders via `createPortal(lightbox, document.body)` to escape `<main inert>` focus trap.
- **Tailwind v4** uses `@theme` in `globals.css` for colors. `@layer base` for global styles. No `tailwind.config.ts`.
- **Path alias:** `@/*` → `./src/*` (configured in `tsconfig.json` and `vitest.config.ts`).
- **Admin auth helper:** `src/lib/supabase/require-admin.ts` — use in `(protected)` server actions to assert authenticated session, not just to fetch user.

## Environment Variables

Required in `.env.local` (see `.env.example`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL          # ⚠ Must be production URL, not localhost
```

## Testing

### Quick start (Docker Supabase)

```bash
npm run test:setup        # Start Docker Supabase + generate .env.test + create admin user
npm test                  # Unit tests (Vitest, 151 tests)
npm run test:e2e:local    # E2E tests against local DB (Playwright, uses .env.test)
npm run test:all          # Both unit + e2e
npm run supabase:stop     # Stop Docker when done
```

- **Unit tests** (`tests/unit/`): Pure logic — availability, schemas, formatting, rate limiting. No DB needed.
- **E2E tests** (`tests/e2e/`): Playwright in serial mode (`workers: 1`, `fullyParallel: false`) — tests share DB state and seed onto "next weekday." Global setup deletes test rows by prefix (`E2E*`, `Test Klijent*`).
- **`test:e2e:local`** swaps `.env.local` ↔ `.env.test` for the run, then restores. If a run is killed mid-script, check that `.env.local.prod` has been moved back to `.env.local`.
- **`.env.test`** is auto-generated by `test:setup` with local Supabase keys. Never committed (in `.gitignore`).
- **`.env.local` points to PRODUCTION** — never run E2E or destructive scripts against it. The Supabase MCP is also wired to prod; do not run mutating queries through it without explicit user confirmation.
