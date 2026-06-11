# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read this whole file before writing any code.** It encodes hard-won invariants (TZ, RLS, race guards, cache rules) that aren't visible from a single file read.

## Commands

```bash
npm run dev               # Next.js 16 dev server (Turbopack, 0.0.0.0:3000)
npm run build             # Production build — webpack (Serwist requires it; Turbopack only for dev)
npm run start             # Start prod build on 0.0.0.0
npm run lint              # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck         # tsc --noEmit
npm test                  # Vitest unit tests (tests/unit/, ~380 tests, no DB)
npm run test:watch        # Vitest watch mode
npm run test:e2e          # Playwright (assumes dev server already running and .env.local in scope)
npm run test:e2e:local    # Swap .env.local↔.env.test for the run, start its own dev server
npm run test:e2e:pwa      # Build prod + run PWA/SEO suites against `next start` (needs prod SW)
npm run test:all          # Units + e2e (local)
npm run test:setup        # Boot Docker Supabase, generate .env.test, create test@admin.com
npm run supabase:start    # Start Docker Supabase only
npm run supabase:stop     # Stop Docker Supabase
```

**Run a single test:**
- Unit: `npx vitest run tests/unit/availability.test.ts` (or `-t "name"` for a single case)
- E2E: `npx playwright test tests/e2e/booking.spec.ts --headed` (use `PLAYWRIGHT_SKIP_WEB_SERVER=1` if dev server is already up)

## Stack at a glance

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 (`@theme` in `globals.css`, no `tailwind.config.ts`) · Supabase (Postgres + Auth + Storage + Realtime + RLS) · Resend (transactional email) · web-push + VAPID (admin push) · Upstash Redis (rate limit, optional) · Serwist (PWA SW) · Vercel.

**Path alias:** `@/*` → `./src/*` (in both `tsconfig.json` and `vitest.config.ts`). `server-only` is stubbed in unit tests via `tests/__mocks__/server-only.ts`.

**Language:** UI text is **Serbian (Latin)**. Code identifiers are English. Date formatting is custom Serbian (`MONTHS`, `DAYS_SHORT` in `src/lib/notifications/templates.ts`) because `Intl` returns Cyrillic for `sr` locales — never switch to `Intl` for user-visible dates without retesting.

**Owner:** Single operator — Una Peranović. Admin email `peranovicuna6@gmail.com` is hardcoded (`src/lib/auth/admin-emails.ts`). Address/phone/social in `src/lib/constants/business.ts` (`BUSINESS` is the SSOT — also used in JSON-LD and email signatures).

## Serbian route name → English meaning

| Route | Meaning | Notes |
|---|---|---|
| `/` | Home | ISR `revalidate=300` |
| `/usluge` | Services | ISR `revalidate=300` |
| `/cjenovnik` | Price list | ISR `revalidate=300` |
| `/galerija` | Gallery | ISR `revalidate=300` |
| `/o-meni` | About | Static |
| `/kontakt` | Contact | Static |
| `/zakazi` | Booking flow (3 steps) | ISR `revalidate=300` for page shell; API is `force-dynamic` |
| `/zakazi/uspjesno?token=<UUID>` | Booking success | UUID `confirmation_token`, never expose sequential ID |
| `/obuka` | Training inquiry form | Writes to `training_inquiries` (separate from appointments) |
| `/politika-privatnosti` | Privacy policy | Static |
| `/uslovi-koriscenja` | Terms of use | Static |
| `/admin/login` | Login | Public (whitelisted in proxy) |
| `/admin/dashboard` | Admin home | `force-dynamic` |
| `/admin/termini` | Appointments list | `force-dynamic`, URL state mirrored to cookies |
| `/admin/usluge` | Services CRUD | Tag-cached reads |
| `/admin/galerija` | Gallery manager | Tag-cached reads |
| `/admin/postavke` | Settings (working hours, blocked dates, time blocks, booking rules, password, push, CSV export) | Tag-cached reads |
| `/api/availability?date&service_id[&admin=true]` | Public slot API | Rate-limited 30/min/IP, `force-dynamic` |
| `/api/availability/month?...` | Month availability | Same rules |
| `/manifest.webmanifest` | Public PWA manifest | Route handler — see "PWA" |
| `/admin/manifest.webmanifest` | Admin PWA manifest | Route handler, separate `id` so both can install side-by-side |
| `/sw.js` | Service worker (Serwist-built from `src/app/sw.ts`) | Prod build only |
| `/~offline` | Offline fallback page | Wired in SW |

Status enums (Serbian, stored as strings in DB):
- `appointments.status`: `ceka` (pending) → `potvrdjen` (confirmed) → `zavrsen` (completed) / `otkazan` (cancelled)
- `training_inquiries.status`: `novi` → `kontaktiran` → `zavrsen`
- `services.category`: `sminkanje` | `pedikir` | `trepavice` | `obuka`
- `gallery_images.category`: `sminkanje` | `svadbeno` | `pedikir` | `trepavice` (note: gallery has `svadbeno`, services do not — keep them separate via `src/lib/gallery/categories.ts`)

## Next.js 16 specifics that bite

This is **not the Next.js you know.** Always check `node_modules/next/dist/docs/` first.

- **`src/proxy.ts` replaces `middleware.ts`.** Matcher is `/admin/:path*` ONLY — API routes are NOT covered. Public PWA assets (`/admin/login`, `/admin/manifest.webmanifest`, `/admin/icon`, `/admin/icon1`, `/admin/apple-icon`) are whitelisted in the proxy so the browser can install the admin PWA before login. **Never add `middleware.ts` — it does nothing.**
- **`after(() => ...)`** (`next/server`) defers fire-and-forget tasks until after the response is sent. Used in booking + admin actions to send Resend emails so `redirect()` doesn't orphan the promise on Vercel serverless. `void fn()` would race the runtime shutdown.
- **`unstable_cache` forbids `cookies()` / `headers()`** inside its scope — Next 16 throws a Server Components render error. `src/lib/cache/cached-queries.ts` uses `createAdminClient()` (no cookies) precisely because of this. Don't switch to `createClient()` thinking it's safer.
- **`next.config.ts` `images.qualities`** must whitelist any non-default quality. We allow `[75, 90]` — `q=90` is used on portrait gallery shots. Default Next 16 rejects anything else with `400`.
- **`next.config.ts` `images.dangerouslyAllowLocalIP: isDev`** is required to load images from local Docker Supabase (`127.0.0.1:54321`). Default Next 16 blocks private IPs as SSRF protection. Prod doesn't need it.
- **`experimental.serverActions.bodySizeLimit: "6mb"`** — gallery upload bumps the default 1 MB cap. Even at 6 MB, gallery uploads are chunked (1 image per call) because a 20-image batch would still exceed.
- **`turbopack: {}`** is intentional empty key — signals Next that webpack (for prod build) and Turbopack (dev) coexist on purpose, because `@serwist/next` only runs in webpack mode. `build` script explicitly uses `next build --webpack`.
- **File-based metadata > layout.metadata.** That's why both manifests are route handlers (`/manifest.webmanifest/route.ts` and `/admin/manifest.webmanifest/route.ts`) — file-based `app/manifest.ts` had higher priority than the admin layout's `metadata.manifest` override.
- **Route group `(protected)`** under `/admin` exists so `/admin/login` does NOT inherit the auth-checking layout. `src/app/admin/(protected)/layout.tsx` does its own auth check on top of the proxy (defense-in-depth) using `redirect()` (NOT `requireAdmin()`, which throws).
- **`src/app/admin/layout.tsx`** sits above the route group and `login`. Its sole job is metadata override (admin manifest, no-index, "UP Admin" title). It renders `{children}` with no UI.
- **`updateTag()`** (from `next/cache`) is used in mutating server actions to invalidate the tag-cached queries. Pair it with `revalidatePath()` for RSC page refresh.

## Three Supabase clients — pick the right one

| Client | File | Key | Cookies | RLS | Use for |
|---|---|---|---|---|---|
| Server (RSC + actions) | `src/lib/supabase/server.ts` (`createClient`) | anon | reads session | Respects (admin via JWT) | RSC pages, route handlers, server actions where session matters |
| Admin (service role) | `src/lib/supabase/admin.ts` (`createAdminClient`) | service_role | none | **Bypasses** | Cross-user reads/writes, cached queries, `/api/availability`, push notifications, write-back from anon flows |
| Public (anon, no cookies) | `src/lib/supabase/public.ts` (`createPublicClient`) | anon | none | Respects (anon role) | ISR-cacheable public pages (homepage featured services, /usluge, /cjenovnik) and the **anon INSERT in `createAppointment`** |
| Browser | `src/lib/supabase/client.ts` (`createClient`, browser SSR) | anon | reads cookies | Respects | Client components (realtime subscribe, push subscribe) |

**`admin.ts` has `import "server-only"`** — never import from client components. Tests stub it via `tests/__mocks__/server-only.ts`.

**Why `createPublicClient()` exists separately from `createClient()`:** the cookie-aware server client makes pages dynamic, which makes Vercel WAF treat them as auth-protected and challenge FB/LinkedIn scrapers — breaking OG preview. `createPublicClient` is cookie-free so public pages stay ISR-cacheable (`revalidate = 300`).

**Why `createAppointment` uses anon for the INSERT (not service role):** the RLS policy `appointments: anon insert` (`WITH CHECK (status='ceka' AND confirmation_sent_at IS NULL)`) is defense-in-depth — even with a bug in the action, the DB blocks status forgery. Reads/validation in the same action use the service-role client.

## Auth model

- **Hardcoded admin allowlist** in `src/lib/auth/admin-emails.ts`. `ADMIN_EMAILS_EXTRA` env var extends it (test only — set by `scripts/setup-test-env.sh` to `test@admin.com`). NEVER set in prod.
- **`requireAdmin()`** (`src/lib/supabase/require-admin.ts`) — call FIRST in every admin server action. Returns the authenticated Supabase server client. Throws on missing/non-admin session.
- **DB-level admin gate** (`20260527000000_security_hardening.sql`): function `public.is_admin()` returns `auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com'`. **Every RLS policy delegates to it.** If you add an admin email to the allowlist, you must also update `is_admin()` — otherwise app-level checks pass but DB writes fail with RLS denial.
- **Login rate limit:** 5 attempts / 5 min per IP, `failClosed: true`.
- **Open-redirect protection:** post-login `?redirect=` runs through `safeRedirect()` (`src/lib/utils/safe-redirect.ts`) — rejects `//evil.com`, `/\evil.com`, `javascript:`, CR/LF, etc.

## Booking availability engine

`src/lib/booking/availability.ts` — pure `computeAvailableSlots(input)`. 30 unit tests cover it.

**Invariants (don't break these):**
- **Fixed 30-min grid.** `SLOT_INTERVAL_MIN = 30`. Independent of service duration (Cal.com pattern — a 120-min service starting at 14:30 is OK; the slot grid is always `:00`/`:30`).
- **Grid alignment enforced 3 places:** UI dropdown → server action via `isGridAligned()` (`src/lib/utils/grid.ts`) → DB exclusion constraint `no_overlapping_appointments` (gist range overlap). Curl/DevTools attempts are caught at server.
- **Single operator.** No `service_id` filter on the overlap check — ANY active appointment (`ceka` OR `potvrdjen`) blocks ALL services. Una is one person.
- **All time math in `Europe/Sarajevo`** via `date-fns-tz`. Vercel runs UTC; bare `new Date()` / `getDay()` / `startOfDay()` are wrong. Use helpers in `src/lib/utils/tz.ts` (`parseDateSarajevo`, `parseSarajevoDateTime`, `atSarajevo`) and `day-bounds.ts` (`getSarajevoDayBounds`, `getSarajevoWeekBounds`, `getSarajevoMonthBounds`, `sarajevoDateStr`, `addDaysToDateStr`). String-compare `YYYY-MM-DD` for date-only equality (leksikografski ispravno).
- **DST-safe arithmetic** anchors at noon (12:00) — never at midnight — because Sarajevo DST tranzicije su uvijek u 02:00/03:00. Adding/subtracting days at noon and then re-formatting to `YYYY-MM-DD` is the pattern used throughout `day-bounds.ts`.
- **Settings cascade:** `BookingSettings` reads `settings` table → `parseBookingSettings()` (`src/lib/settings/read.ts`) coerces + validates → falls back to `BOOKING_RULES` constants (`src/lib/constants/business.ts`). Valid keys: `min_hours_before`, `advance_booking_days`, `cancellation_hours`, `break_between_min`. Unknown rows are ignored (forward-compat).
- **`break_between_min`** is enforced only at server level (extends effective end of each appointment in the overlap check). Allowed values: `0, 30, 60, 90, 120` (multiples of 30 only — validated in `updateSetting`).
- **`skipMinHoursBefore: true`** is passed when admin is calling — Una can book "today." `/api/availability?admin=true` only honors this after re-verifying the cookie session (do NOT trust the query param blindly).
- **`time_blocks_public` view** (`20260427000000_time_blocks_public_view.sql`) hides `reason` from anon. `/api/availability` reads this view, not the raw table. The raw table is admin-only (RLS denies anon SELECT).

**Two-stage server validation in `createAppointment` (`src/app/zakazi/actions.ts`):**
1. `bookingFormSchema.safeParse()` — Zod (`src/lib/booking/schemas.ts`).
2. Service lookup — must exist, be `bookable && active`, have `duration_min`.
3. `isGridAligned(start)` — defense in depth.
4. `min_hours_before` check (reads live settings, not constants).
5. `validateSlotServerSide(sb, start, end)` — working hours, blocked dates, time blocks (`src/lib/booking/validate-slot.ts`).
6. **Race guard** — `select * from appointments where status in ('ceka','potvrdjen') and start_time < end and end_time > start limit 1`. If even one row exists, fail with a UI-friendly "termin upravo zauzet" message.
7. **DB-level guarantee** — gist exclusion constraint `no_overlapping_appointments` (`20260411100000_no_overlapping.sql`). Even if the race guard misses, the DB rejects the insert.
8. INSERT with `crypto.randomUUID()` as `confirmation_token` (UUID, not sequential ID — prevents IDOR on `/zakazi/uspjesno`).

**Three after() tasks fire post-redirect:**
- Admin email (`sendNewAppointmentEmail`) with `.ics` REQUEST attachment.
- Client "primljeno" email (`sendBookingReceivedEmail`, no `.ics` — final `.ics` comes only when admin confirms).
- Admin push notification (`sendAdminPushNotification`) — fire-and-forget `void`, not in `after()`, because we don't need post-response context.

## Rate limiting

`src/lib/utils/rate-limit.ts`:
- **Upstash Redis sliding window** when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set; **in-memory Map** fallback (auto-GC every 5 min) otherwise.
- `checkRateLimit(ip, limit, windowMs, { failClosed })`:
  - `failClosed: true` — on Upstash error, deny. Used on **booking** (5/min) and **admin login** (5 / 5 min).
  - `failClosed: false` (default) — on Upstash error, fall back to memory. Used on `/api/availability` (30/min).
- `getClientIp(headers)` — prefers `x-real-ip` (set by Vercel/nginx, not spoofable) over the last entry of `x-forwarded-for` (trusted edge). The first entry of XFF is client-controlled.
- Limiter instances are cached per `(limit, windowMs)`.
- **Upstash minimum granularity is 1 s** — sub-second windows are rounded up.

## Email notifications (Resend)

`src/lib/notifications/`:
- `templates.ts` — five HTML+text templates with Serbian date formatting (`formatDateSr` uses `Intl.DateTimeFormat` ISO weekday + a hand-rolled Cyrillic→Latin mapping). HTML-escape every dynamic value (`escapeHtml`, `escapeHtmlAttr`).
- `resend.ts` — lazy Resend client (warns + skips if `RESEND_API_KEY` missing — does NOT throw, must not break booking).
- `ics.ts` — RFC 5545 VEVENT builder. UTC times with `Z` suffix (calendar apps localize). Supports `method: "REQUEST" | "CANCEL"`.
- `send-admin-email.ts` — admin notification on new booking. ICS attachment UID: `appt-<id>@upmakeup.ba`.
- `send-booking-received-email.ts` — client "primili smo" (no `.ics`).
- `send-client-email.ts` — client confirmation when admin confirms (with `.ics` REQUEST).
- `send-cancellation-email.ts` — client cancellation (with `.ics` CANCEL, same UID).

**Email tracking columns** (`20260526200000_email_tracking_columns.sql`) on `appointments`:
- `email_received_sent_at`, `email_confirmed_sent_at`, `email_cancelled_sent_at`. `NULL` = not sent. Timestamp is written AFTER successful Resend call, best-effort, never blocks flow.

**Out of scope for now (don't add without confirming with the user):** 24h reminder cron, training inquiry email to client.

**Required prod env:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default `rezervacije@upmakeup.ba`, domain must be verified in Resend), `ADMIN_NOTIFICATION_EMAIL`.

## Web Push (admin only)

`src/lib/push/`:
- `vapid.ts` — `getConfiguredWebPush()` lazy-configures `web-push` with VAPID. Throws (fail loud) if env vars missing.
- `send.ts` — `sendAdminPushNotification(payload)`:
  - Uses **`createAdminClient`** because the booking flow has no admin session.
  - Reads ALL rows from `push_subscriptions` (no filter — all admin devices get notified).
  - On `404`/`410` from push provider → delete the subscription row.
  - On success → fire-and-forget `last_used_at = now()` (no await).
- Subscribe + unsubscribe actions: `src/app/admin/(protected)/postavke/push-actions.ts`. Upsert keyed on `endpoint` (unique constraint).
- `src/components/admin/PushNotificationToggle.tsx` is the client UI.

**SW handlers** in `src/app/sw.ts`:
- `push` event → `showNotification` with `tag: "new-appointment"`, parses payload `{ title, body, url }`, falls back to generic text on JSON parse failure.
- `notificationclick` → focus existing admin tab if open, otherwise `clients.openWindow(url)`.

**Required env:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (exposed to client for `PushManager.subscribe`), `VAPID_PRIVATE_KEY` (server only — never `NEXT_PUBLIC_*`), `VAPID_SUBJECT` (must be `mailto:` or `https://` URL). Generate with `npx web-push generate-vapid-keys --json`.

## Service worker + PWA

`src/app/sw.ts` (Serwist), generated at `public/sw.js` by `next build` only (`disable: isDev` in `next.config.ts` — Turbopack HMR fights SW caching, so dev never has a SW).

**Routing rules (top to bottom):**
1. **`/admin/*`** — bypass SW entirely. Custom listener calls `event.stopImmediatePropagation()` then `event.respondWith(fetch(...))` so admin requests go direct to network. Admin needs Supabase auth + DB; offline mode is meaningless and Serwist's `NetworkOnly` would emit ugly `no-response` errors.
2. `/api/*` — `NetworkOnly`.
3. `/zakazi/*` — `NetworkOnly` (real-time availability).
4. Supabase storage images — `CacheFirst`, 30 days, 200 entries.
5. `/_next/image` — `StaleWhileRevalidate`, 7 days, 100 entries.
6. `/_next/static` — `CacheFirst` (hashed, immutable).
7. HTML documents — `NetworkFirst`, 3 s timeout, 7 days, 32 entries. Fallback to `/~offline`.
8. Defaults (`...defaultCache`) for fonts etc.

**Two manifests, both as route handlers:**
- `/manifest.webmanifest` — public PWA. `start_url: "/"`, `scope: "/"`.
- `/admin/manifest.webmanifest` — admin PWA. `id: "/admin"` (so it's a separate installable app), `start_url: "/admin/dashboard"`, `scope: "/admin"`.
- Brand colors come from `src/lib/constants/theme.ts` (`BRAND_COLORS`). Keep `globals.css @theme` colors in sync — they're sourced from this file in metadata routes (manifest, OG image).

**Install prompt** (`src/components/public/InstallPrompt.tsx`) — only on public routes (admin uses iOS Share). Skips if standalone-mode already, skips if dismissed in last 30 days (localStorage key `up-beauty-install-dismissed`), shows after 5 s delay so it doesn't fight CookieBanner.

## Realtime appointments

`supabase_realtime` publication includes `appointments` with `REPLICA IDENTITY FULL` (`20260518000000_realtime_appointments.sql`).

`src/components/admin/AppointmentsRealtime.tsx`:
- Browser client subscribes to `postgres_changes` on `appointments` (all events).
- **Auth propagation gotcha:** `createBrowserClient` reads the session for HTTP queries, but the realtime sub-client has separate auth state. **Must call `sb.realtime.setAuth(token)` BEFORE subscribe.** Otherwise the server filters events because RLS emits only for `authenticated` role.
- Also listens to `onAuthStateChange` — re-subscribes when the access_token refreshes (PWA hydration race).
- On event → `router.refresh()` triggers RSC re-fetch. The component renders nothing.
- **Diagnostic `console.log`s are intentional** — leave them; they were lifesavers debugging the auth propagation issue.

## Caching architecture

**Public pages:** ISR via `export const revalidate = 300` (5 min). Use `createPublicClient()` (no cookies → cacheable). Pages: `/`, `/usluge`, `/cjenovnik`, `/galerija`, `/zakazi`.

**Admin pages:** `unstable_cache` with explicit tags (`src/lib/cache/cached-queries.ts`):
- `getCachedServices()`, `getCachedGalleryImages()`, `getCachedWorkingHours()`, `getCachedBlockedDates()`, `getCachedTimeBlocks()`, `getCachedSettings()`.
- All use `createAdminClient` (no cookies — required for `unstable_cache`).
- Invalidation = `updateTag(ADMIN_CACHE_TAGS.X)` in mutating actions, paired with `revalidatePath()`. Tag names in `src/lib/cache/admin-cache-tags.ts` use `admin:` prefix namespace.
- **Reads bypass RLS** — safe because cached data has no per-user dimension and the `(protected)` layout already gates access.
- **`/admin/dashboard`, `/admin/termini`** explicitly opt out: `export const dynamic = "force-dynamic"` (live data).

**API routes:** `export const dynamic = "force-dynamic"` + `revalidate = 0`.

**When you add a new mutating admin action:** identify the entity, find its `ADMIN_CACHE_TAGS` key, call `updateTag(tag)` + `revalidatePath("/admin/<route>")`. If no tag fits, add a new entry to `admin-cache-tags.ts`.

## Admin filter persistence (cookies)

`src/lib/utils/admin-prefs.ts` — cookie-backed prefs for the admin Termini list (date / range / status / sort) and Dashboard date.
- Cookie attrs: `Path=/admin; Max-Age=31536000; SameSite=Lax`. **NOT HttpOnly** — `AdminPrefsPersister` client component writes them.
- `resolveTerminiPrefs(urlParams, cookiePrefs)` merges URL → cookie → defaults with deterministic 4-step logic (date and range are mutually exclusive: setting `?date=` forces range to "svi").
- `computeDefaultSort` — single-day views ASC, multi-day DESC.
- Always validate cookie values (`isValidDate`/`isValidRange`/...) — never trust client-written cookies.

## Image pipeline

**Gallery upload** (`src/app/admin/(protected)/galerija/actions.ts` `uploadSingleGalleryImage`):
1. Client compresses to WebP via `browser-image-compression` (max 300 KB, 1600 px).
2. **One image per server-action call** (chunked) — even with 6 MB body limit, a 20-image batch exceeds.
3. Server validates size (5 MB max), MIME (JPEG/PNG/WebP via sharp metadata sniff — not trusting `file.type`), max dimension 4096 px.
4. Server re-encodes via sharp: `resize(1920, 1920, fit:"inside")` → `webp(quality: 88)`. Even if client sent JPEG (Safari quirk), server outputs WebP.
5. Storage path: `gallery/<id>-<random>.webp` in `gallery` bucket.
6. **Cache invalidation is deferred** to a separate `revalidateGallery()` call after the entire batch — otherwise N images = N invalidations.

**Service image:** same pipeline (`processServiceImage` in `usluge/actions.ts`), but resized to 1200×1200, q=85. Bucket: `services`.

**Storage buckets:** both `gallery` and `services` are `public=true` with admin-only write RLS (`20260527000000_security_hardening.sql`). Image rendering goes through `next/image` (remotePatterns matches `/storage/v1/object/public/**`).

**Hero images** are static files in `/public/images/hero-section-v2/` indexed in `src/lib/images/hero-images.ts`. `HERO_IMAGES` is the bento order; `HERO_MOBILE_IMAGE` is a different portrait shot. Files outside the registry are reserve assets.

## Recurring time blocks

`src/lib/utils/recurring-blocks.ts` — `expandWeeklyTimeBlocks({ startDateStr, startTimeStr, endTimeStr, untilDateStr })`.
- **Materialized** (not query-time) — server inserts N rows with same `recurrence_group_id` (UUID). Availability engine reads rows unchanged.
- **Cap:** `MAX_WEEKLY_OCCURRENCES = 260` (≈5 yrs of weekly slots, also enforced via `maxUntilDateStr`).
- **DST-safe** — each occurrence is parsed as Sarajevo wall-clock via `parseSarajevoDateTime`, so "every Monday 12:00" stays 12:00 local across spring/fall transitions (UTC shifts ±1 h).
- `deleteTimeBlockSeries(groupId)` removes all occurrences in the series. UUID format is validated.

## Database

**Migrations** (chronological, in `supabase/migrations/`):

| File | What it does |
|---|---|
| `20260409100000_init_schema.sql` | `services`, `appointments` (exclusion-friendly schema), `blocked_dates`, `gallery_images`, `training_inquiries`, `working_hours` + indexes + `set_updated_at()` trigger |
| `20260409100100_rls_policies.sql` | Initial RLS (later replaced) |
| `20260409100200_seed_data.sql` | Service catalog seed |
| `20260409120000_time_blocks.sql` | `time_blocks` table (sub-day blocks: zubar, privatne) |
| `20260410_settings.sql` | `settings` key-value store + seed with BOOKING_RULES defaults |
| `20260411100000_no_overlapping.sql` | gist exclusion constraint `no_overlapping_appointments` (requires `btree_gist`) — DB-level race guard |
| `20260411100001_confirmation_token.sql` | UUID `confirmation_token` (IDOR fix) |
| `20260422_tighten_rls.sql` | First attempt to tighten anon INSERT (later policy name fix in security_hardening) |
| `20260427000000_time_blocks_public_view.sql` | `time_blocks_public` view that hides `reason` from anon |
| `20260427000001_storage_policies.sql` | gallery bucket policies |
| `20260428000000_optional_service_price.sql` | `price` becomes nullable; CHECK requires either `price` or `price_note` |
| `20260504100000_service_image.sql` | `services.image_path` + `services` storage bucket |
| `20260518000000_realtime_appointments.sql` | Adds `appointments` to `supabase_realtime` publication + `REPLICA IDENTITY FULL` |
| `20260518000001_push_subscriptions.sql` | `push_subscriptions` table (initial RLS, replaced) |
| `20260520000000_appointments_price_snapshot.sql` | `appointments.price_snapshot` — snapshot at `markCompleted` time so historical revenue stays immutable across price changes |
| `20260524100000_time_blocks_recurrence.sql` | `time_blocks.recurrence_group_id` (UUID, nullable) |
| `20260526200000_email_tracking_columns.sql` | `email_received_sent_at`, `email_confirmed_sent_at`, `email_cancelled_sent_at` |
| `20260527000000_security_hardening.sql` | **Drops every old policy by exact name** (`public insert`/`anon insert`/`authenticated full access`) and replaces with `is_admin()`-gated admin policies + admin-only storage policies. **This is the SSOT for current RLS.** |

**Tables (10 in `public` schema):**
- `services` (catalog) — `category` ∈ {`sminkanje`,`pedikir`,`trepavice`,`obuka`}, `bookable` (show in /zakazi), `active` (show anywhere), `price` nullable but constrained, `image_path` nullable, `order_index`, `variable_price`.
- `appointments` — see status flow above. Has exclusion constraint on active statuses. Indexes on `start_time`, `status`, partial on active range.
- `blocked_dates` — multi-day date ranges (`date_from`, `date_to`).
- `time_blocks` — sub-day intervals (`start_time`, `end_time`, `reason`, `recurrence_group_id`). Anon reads via `time_blocks_public` view (no `reason`).
- `working_hours` — per day_of_week (0=Sun..6=Sat), `open_time`, `close_time`, `is_open`.
- `gallery_images` — `storage_path`, `category` (different categories from `services`!), `order_index`.
- `training_inquiries` — separate from appointments. `status` ∈ {`novi`,`kontaktiran`,`zavrsen`}.
- `settings` — key/value/updated_at. Allowed keys: `min_hours_before`, `advance_booking_days`, `cancellation_hours`, `break_between_min`.
- `push_subscriptions` — admin VAPID subscriptions. `endpoint` UNIQUE.
- `time_blocks_public` (VIEW, security definer) — public projection.

**Regenerate types after any schema change:**
```bash
supabase gen types typescript --local > src/types/database.ts
```

**For schema questions, use the `supabase` MCP server — but read first, write never (the MCP is wired to PRODUCTION).**

## Server actions pattern

Live in `actions.ts` next to the page (`src/app/<route>/actions.ts`). Template:

```ts
"use server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
import { after } from "next/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function myAction(fd: FormData): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();              // 1. auth (always first)
    const parsed = mySchema.parse(...);            // 2. validate input with Zod
    const { error } = await sb.from(...).update(...).eq(...);
    if (error) return { ok: false, error: error.message };
    updateTag(ADMIN_CACHE_TAGS.X);                 // 3. invalidate tag cache
    revalidatePath("/admin/<route>");              // 4. invalidate page
    after(() => sendNotification(...));            // 5. fire-and-forget (optional)
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

**Public anon actions** (only `createAppointment` and the training inquiry):
- Start with `getClientIp(headers)` + `checkRateLimit(ip, ..., { failClosed: true })`.
- Use `createAdminClient()` for reads/validation and `createPublicClient()` for the INSERT (so RLS enforces `status='ceka'` constraint).

## Adding a new admin action / API route

1. **Need auth?** Yes → call `requireAdmin()` first (server action) or check session via `createClient()` + `isAdminEmail()` (API route — `proxy.ts` does NOT cover API).
2. **Need to invalidate caches?** Identify the entity → `updateTag` + `revalidatePath`. New entity → add to `ADMIN_CACHE_TAGS`.
3. **Need fire-and-forget (email/push)?** Wrap in `after(() => fn())`. Don't `void fn()` — Vercel may kill the runtime.
4. **DB schema change?** Add migration → run `supabase db push` (or `supabase migration up` locally) → regenerate types.
5. **New table?** Decide RLS: admin-only via `is_admin()` (default), or public-read + admin-write, or anon-insert with `WITH CHECK` constraint. Mirror the patterns in `20260527000000_security_hardening.sql`.

## Environment variables

`.env.example` is the source of truth. Required in prod:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL          # MUST be the prod URL, no trailing slash, no \n
RESEND_API_KEY
RESEND_FROM_EMAIL             # default rezervacije@upmakeup.ba
ADMIN_NOTIFICATION_EMAIL
NEXT_PUBLIC_VAPID_PUBLIC_KEY  # exposed to client
VAPID_PRIVATE_KEY             # server only
VAPID_SUBJECT                 # mailto: or https:
```

Optional:
```
UPSTASH_REDIS_REST_URL        # without this, rate limiter uses in-memory
UPSTASH_REDIS_REST_TOKEN
ADMIN_EMAILS_EXTRA            # test/staging only, NEVER in prod
```

**Known bug:** historic Vercel env vars for this project sometimes had a literal `\n` at the end of `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SITE_URL` from careless paste. `normalizeSiteUrl()` (`src/lib/utils/site-url.ts`) defensively strips trailing whitespace+slash in one combined regex pass — sequential `.replace` was bypassed by `"https://x\n/"`. Whitespace in URLs broke JSON-LD `@id` and Google rich-result eligibility. Whenever you read `NEXT_PUBLIC_SITE_URL`, run it through `normalizeSiteUrl()`.

## Security model — quick reference

- **CSP** in `next.config.ts`: `default-src 'self'`. Dev allows `'unsafe-eval'` (Turbopack); prod doesn't. Both still allow `'unsafe-inline'` (Next.js inline runtime — pending nonce migration). Supabase URLs injected dynamically for both HTTP and WebSocket (dev uses `127.0.0.1:54321` + ws, prod uses `*.supabase.co` + wss). `frame-ancestors 'none'`, `form-action 'self'`.
- **HSTS** 1 year + includeSubDomains, **X-Frame-Options DENY**, **X-Content-Type-Options nosniff**, **Permissions-Policy** (no camera/mic/geo).
- **PII sanitization** in logs: `sanitizeError(err)` (`src/lib/utils/log.ts`) strips emails, phones, trailing quoted strings, caps at 80 chars. Use it on every `console.error` in server code — Vercel logs are retained months and team-visible.
- **IDOR fixes:** `/zakazi/uspjesno?token=<UUID>` uses `confirmation_token` (UUID), not sequential `id`. Same approach if you add any public look-up by row.
- **Confirmation token uniqueness:** partial unique index `WHERE confirmation_token IS NOT NULL`.
- **`appointments: anon insert` policy** restricts anon to `status='ceka' AND confirmation_sent_at IS NULL`. Don't relax it.
- **Security audit:** `claudedocs/SECURITY-AUDIT-2026-05-26.md` is the red-team report (Opus 4.7). Most criticals (K1–K3) were fixed by `20260527000000_security_hardening.sql`. K4 (secrets on dev disk) and V-series items need ongoing vigilance — read it before doing any security-sensitive change.

## Testing

### Setup

```bash
npm run test:setup        # Starts Docker Supabase, extracts keys via `supabase status -o env`,
                          # writes .env.test (LOCAL ONLY — gitignored), creates test@admin.com
```

The script seeds:
- `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` (used by `tests/e2e/global-setup.ts` and `tests/e2e/helpers.ts`).
- `E2E_ADMIN_EMAIL=test@admin.com`, `E2E_ADMIN_PASSWORD=Test1234A`.
- `ADMIN_EMAILS_EXTRA=test@admin.com` (only respected because of `admin-emails.ts` — read at runtime).

### Run tests

```bash
npm test                  # Vitest unit (jsdom). ~380 tests across ~70 files.
npm run test:e2e:local    # Playwright. Swaps .env.local → .env.local.prod → .env.test → .env.local
                          # for the duration; restores on EXIT (success OR failure).
                          # If a run is killed (e.g. Ctrl-Z then kill -9), MANUALLY check that
                          # .env.local.prod is moved back to .env.local before running anything else.
npm run test:e2e:pwa      # Builds prod + runs `next start` in background, runs pwa+seo specs.
                          # Needed because SW is disabled in dev.
```

### E2E specifics

- **Serial** (`workers: 1`, `fullyParallel: false`) — tests share DB state and seed onto "next weekday."
- **Global setup** (`tests/e2e/global-setup.ts`) deletes any rows where `client_name LIKE 'Test Klijent%' OR 'E2E%'` and `time_blocks` where `reason LIKE 'E2E%'`. **Always prefix test data with `E2E ` or `Test Klijent `** so it gets cleaned.
- **`sarajevoDate(...)` helper** in `tests/e2e/helpers.ts` — auto-detects CET/CEST offset for the test date.
- **`E2E_SUPABASE_SERVICE_ROLE_KEY=`** is intentionally blanked in `test:e2e:pwa` (PWA suite hits live prod build at `localhost:3000`; global-setup skips when unset).
- **`PLAYWRIGHT_SKIP_WEB_SERVER=1`** disables auto-start of dev server when you've already started one (manual run, PWA script).
- `playwright.config.ts` reads `DOTENV_CONFIG_PATH` (defaults to `.env.local`). The `webServer.command` injects env vars by xargs from that path.

### Unit tests

`vitest.config.ts` uses jsdom, includes `tests/unit/**/*.test.{ts,tsx}`. `server-only` is stubbed (no React server context in unit-land).

### Coverage highlights

Notable unit-tested modules: `availability` (30 tests), `validate-slot`, `month-availability`, `rate-limit`, `safe-redirect` (open-redirect surface), `recurring-blocks` (DST), `tz`/`day-bounds` (boundary cases), every email template + `ics`, `admin-prefs` (cookie merge logic), `push-payload`, `wa`/`wa-messages`, `phone`, `settings` parsing.

### CRITICAL test safety rules

- **`.env.local` points to PRODUCTION** in normal dev (the file currently checked in may not — verify before running E2E manually). **Never** run E2E directly or run destructive scripts against `.env.local` without confirming it's pointed at the local Docker stack.
- **The Supabase MCP is also wired to prod.** Read-only queries are fine; never run mutating queries through it without explicit user confirmation.
- `.env.test` is autogenerated and gitignored; safe to wipe via `npm run test:setup`.
- The e2e script's `EXIT=$?; mv .env.local.prod .env.local` runs on success AND failure, but does NOT trap signals — if you `kill -9` the process, the swap is left in place. The signature of a broken swap state: `.env.local` looks like test config (`API_URL=http://127.0.0.1:54321`) and `.env.local.prod` exists.

## Things that look weird but are correct

- **`turbopack: {}`** empty key in `next.config.ts` — intentional. Suppresses Next's webpack/Turbopack conflict warning for Serwist.
- **CSS in `globals.css` uses Tailwind v4 `@theme`** instead of `tailwind.config.ts`. There is NO Tailwind config file.
- **`tsconfig.json` includes `webworker` lib** — needed for `src/app/sw.ts` (`ServiceWorkerGlobalScope`).
- **The two manifest route handlers** (not file-based `manifest.ts`) — intentional, see Next.js 16 specifics above.
- **The SW intentionally throws away admin requests** — see SW routing rules above. The `event.stopImmediatePropagation()` is essential to silence Serwist's secondary listener.
- **`createPublicClient` vs `createClient`** — both use anon key. The cookie-aware one (server.ts) makes pages dynamic and kills ISR. The public one keeps pages static.
- **`AppointmentsRealtime.tsx` console.logs** — leave them; documented.
- **`order_index`** sort key on `services` and `gallery_images` — drag-and-drop ordering. Admin UI sets it; don't infer it from `id`.
- **Multiple `revalidatePath()` calls in one action** (e.g. `confirmAppointment` revalidates both `/admin/termini` and `/admin/dashboard`) — they share data.
- **`pt-safe`/`pb-safe`** utilities in `globals.css` (`@utility`) — `max(1rem, env(safe-area-inset-*))` for iOS notch/home-indicator under `viewport-fit=cover`. Required for PWA standalone mode.
- **Form inputs forced to `font-size: 16px`** in `@layer base` — prevents iOS Safari auto-zoom on focus (triggers at <16 px).
- **Status `zavrsen` not in `appointments: anon insert WITH CHECK`** but exists in `status` CHECK enum — correct: anon can only insert `ceka`, admin transitions to `zavrsen`.
- **Price snapshot** in `markCompleted` — historical revenue must be immutable across price changes. `dashboard` revenue query reads `price_snapshot`, not `services.price`.
- **`hours_map` for `working_hours`** trims `"17:00:00"` → `"17:00"` (`hoursMapFromRows`) because Postgres `time` type round-trips with seconds.

## Common workflow recipes

**Run E2E with debugging:**
```bash
PWDEBUG=1 npm run test:e2e:local -- tests/e2e/booking.spec.ts
```

**Add a new admin setting:**
1. Migration: `INSERT INTO settings ...` with default value (or rely on `parseBookingSettings` fallback).
2. Add to `KEY_MAP` in `src/lib/settings/read.ts` and `BookingSettings` type.
3. Read in `availability.ts` via `input.settings?.X ?? BOOKING_RULES.X`.
4. UI control in `src/components/admin/BookingRulesEditor.tsx`.
5. Validation in `updateSetting` action (`postavke/actions.ts`) — append to `ALLOWED_SETTING_KEYS`.

**Add a new email template:**
1. Add render function in `src/lib/notifications/templates.ts` (HTML+text dual render, escape inputs).
2. Add `src/lib/notifications/send-X.ts` (Resend call + ICS attachment if calendar-relevant).
3. Wire into the action with `after(() => sendX(...))`.
4. If you track delivery, add a column to `appointments` (timestamp, nullable) and write inside the send function on success.
5. Unit-test render + send (mock Resend).

**Add a new public route:**
- Decide if it's ISR (`export const revalidate = 300` + `createPublicClient`) or dynamic.
- Add to `src/app/sitemap.ts` and JSON-LD breadcrumbs (`src/lib/seo/breadcrumbs-jsonld.ts`) if discoverable.
- Add hreflang/OG metadata at the page level.

**Add a new admin API route:**
- `proxy.ts` does NOT cover `/api/*`. Inside the handler: `const sb = await createClient(); const { data: { user } } = await sb.auth.getUser(); if (!user || !isAdminEmail(user.email)) return 401`. See `/api/availability` for the pattern of using `force-dynamic` + service role after the auth check.

## When stuck

- **TZ off by one day?** You're using `new Date()`, `getDay()`, or `startOfDay()` on raw Dates. Switch to `parseDateSarajevo`, `toZonedTime`, `formatInTimeZone` from `date-fns-tz`.
- **DB write fails with RLS error from admin action?** Check that `is_admin()` returns true for your JWT email (it hardcodes `peranovicuna6@gmail.com`). For tests, you need the actual admin email — `test@admin.com` will FAIL DB writes through the regular client (RLS denial) even though `requireAdmin()` passes (it uses `ADMIN_EMAILS_EXTRA`). Tests that mutate go through `createAdminClient()` directly in helpers, NOT through normal actions.
- **`unstable_cache` "Server Components render" error?** You're reading cookies/headers inside the cached function. Use `createAdminClient`.
- **Realtime events not firing?** You forgot `sb.realtime.setAuth(token)` before `.subscribe()`.
- **Image won't load from local Supabase?** Confirm `dangerouslyAllowLocalIP: isDev` in `next.config.ts` and that `127.0.0.1:54321` is in `remotePatterns`.
- **CSP errors in console?** Check `next.config.ts` — Supabase URLs are injected from `NEXT_PUBLIC_SUPABASE_URL` so an env var mismatch breaks WebSocket/image src.
- **Booking inserts twice?** That should be impossible — check for duplicate form submission (button not disabled during pending). DB exclusion constraint will reject the second.
- **Email didn't send but no error?** Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in env. `getResendClient()` warns and skips silently if missing. Check Vercel logs for `[email skipped]` lines.

## Deployment (Vercel)

1. Create prod Supabase project (`eu-central-1`).
2. `supabase link --project-ref <ref>` and `supabase db push` to apply all migrations.
3. Create admin user `peranovicuna6@gmail.com` via Supabase Auth dashboard.
4. Verify Resend domain (`upmakeup.ba` SPF + DKIM) and create API key.
5. Generate VAPID keys: `npx web-push generate-vapid-keys --json`.
6. Vercel env vars (Production scope): everything in `.env.example` except optional Upstash if not using.
7. Deploy → smoke test home, booking flow, admin login. Then add the custom domain in Vercel AND in Supabase Auth → URL Configuration (Redirect URLs allowlist must include the production origin).
8. **Watch out for `\n` in env vars** — paste via the Vercel CLI or carefully verify after pasting in the UI. See "Environment variables" above.

## Project history & docs

- `README.md` — Serbian-language onboarding for the project owner / NextPixel devs. Bird's-eye view, less detail than this file.
- `claudedocs/SECURITY-AUDIT-2026-05-26.md` — adversarial security audit. Many items are fixed; some are notes for the future.
- `docs/` — older planning artifacts.
- `AGENTS.md` — one-liner warning: "this is NOT the Next.js you know."

## Licence
NextPixel built it. © 2026 UP Makeup.
