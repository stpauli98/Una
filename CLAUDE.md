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

8 migrations in `supabase/migrations/`. Key tables: `services`, `appointments`, `blocked_dates`, `working_hours`, `gallery_images`, `settings`.

Regenerate types after schema changes:
```bash
supabase gen types typescript --local > src/types/database.ts
```

`appointments` table has an exclusion constraint (`no_overlapping_appointments`) preventing overlapping active bookings at the DB level.

### Key Patterns

- **Server actions** live in `actions.ts` files next to their page (e.g., `src/app/zakazi/actions.ts`).
- **Revalidation** uses `revalidatePath()` + `router.refresh()` for RSC data sync.
- **Rate limiting** via in-memory Map in `src/lib/utils/rate-limit.ts` (soft limit, resets on cold start).
- **Success page** uses UUID `confirmation_token` (not sequential ID) to prevent IDOR.
- **Gallery lightbox** renders via `createPortal(lightbox, document.body)` to escape `<main inert>` focus trap.
- **Tailwind v4** uses `@theme` in `globals.css` for colors. `@layer base` for global styles. No `tailwind.config.ts`.

## Environment Variables

Required in `.env.local` (see `.env.example`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL          # ⚠ Must be production URL, not localhost
```

## Testing

- **Unit tests** (`tests/unit/`): Pure logic — availability slots, formatting, validation. Run with `npm test`.
- **E2E tests** (`tests/e2e/`): Playwright in serial mode (1 worker). Global setup cleans test data. Run with `npm run test:e2e`.
- Backend testing uses Docker (`supabase start`).
