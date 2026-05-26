# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 26 security vulnerabilities identified in the adversarial audit (claudedocs/SECURITY-AUDIT-2026-05-26.md).

**Architecture:** One SQL migration for all database/RLS fixes, then sweep through application files in dependency order. Each task is self-contained and produces a commit.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + RLS + Storage), TypeScript, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-05-26-security-hardening-design.md`

---

## Task 1: RLS Security Hardening Migration

**Fixes:** K1 (policy name mismatch), K2 (authenticated full access), K3 (storage policies), S4 (realtime PII), S5 (time block reasons)

**Files:**
- Create: `supabase/migrations/20260527000000_security_hardening.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Security hardening: replace permissive RLS policies with admin-only access.
--
-- Background: the original policies granted full CRUD to any `authenticated`
-- user, not just admin. Additionally, the "tighten RLS" migration
-- (20260422_tighten_rls.sql) dropped a policy named "appointments: anon insert"
-- but the original was named "appointments: public insert" — so the permissive
-- INSERT policy was never removed.

-- ═══════════════════════════════════════════════════════════════
-- 1. Helper function: checks if the current JWT belongs to admin
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com' $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Drop ALL old policies (use exact names from each migration)
-- ═══════════════════════════════════════════════════════════════

-- appointments (from 20260409100100 + 20260422)
DROP POLICY IF EXISTS "appointments: public insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments: anon insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments: authenticated full access" ON public.appointments;

-- training_inquiries (from 20260409100100 + 20260422)
DROP POLICY IF EXISTS "training_inquiries: public insert" ON public.training_inquiries;
DROP POLICY IF EXISTS "training_inquiries: anon insert" ON public.training_inquiries;
DROP POLICY IF EXISTS "training_inquiries: authenticated full access" ON public.training_inquiries;

-- services
DROP POLICY IF EXISTS "services: public read active" ON public.services;
DROP POLICY IF EXISTS "services: authenticated full access" ON public.services;

-- gallery_images
DROP POLICY IF EXISTS "gallery: public read" ON public.gallery_images;
DROP POLICY IF EXISTS "gallery: authenticated full access" ON public.gallery_images;

-- blocked_dates
DROP POLICY IF EXISTS "blocked_dates: public read" ON public.blocked_dates;
DROP POLICY IF EXISTS "blocked_dates: authenticated full access" ON public.blocked_dates;

-- working_hours
DROP POLICY IF EXISTS "working_hours: public read" ON public.working_hours;
DROP POLICY IF EXISTS "working_hours: authenticated full access" ON public.working_hours;

-- time_blocks (from 20260409120000)
DROP POLICY IF EXISTS "time_blocks: public read" ON public.time_blocks;
DROP POLICY IF EXISTS "time_blocks: authenticated full access" ON public.time_blocks;

-- settings (from 20260410)
DROP POLICY IF EXISTS "settings: public read" ON public.settings;
DROP POLICY IF EXISTS "settings: authenticated full access" ON public.settings;

-- push_subscriptions (from 20260518000001)
DROP POLICY IF EXISTS "push_subscriptions: user can read own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: user can insert own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: user can delete own" ON public.push_subscriptions;

-- storage: gallery bucket (from 20260427000001)
DROP POLICY IF EXISTS "gallery: public read" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated delete" ON storage.objects;

-- storage: services bucket (from 20260504100000)
DROP POLICY IF EXISTS "services: public read" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated delete" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════
-- 3. New policies: admin-only write, public read where appropriate
-- ═══════════════════════════════════════════════════════════════

-- services
CREATE POLICY "services: anon read active"
  ON public.services FOR SELECT TO anon
  USING (active = true);
CREATE POLICY "services: admin full"
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- gallery_images
CREATE POLICY "gallery_images: public read"
  ON public.gallery_images FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "gallery_images: admin write"
  ON public.gallery_images FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "gallery_images: admin update"
  ON public.gallery_images FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "gallery_images: admin delete"
  ON public.gallery_images FOR DELETE TO authenticated
  USING (public.is_admin());

-- blocked_dates
CREATE POLICY "blocked_dates: public read"
  ON public.blocked_dates FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "blocked_dates: admin full"
  ON public.blocked_dates FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- working_hours
CREATE POLICY "working_hours: public read"
  ON public.working_hours FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "working_hours: admin full"
  ON public.working_hours FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- appointments
CREATE POLICY "appointments: anon insert"
  ON public.appointments FOR INSERT TO anon
  WITH CHECK (status = 'ceka' AND confirmation_sent_at IS NULL);
CREATE POLICY "appointments: admin full"
  ON public.appointments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- training_inquiries
CREATE POLICY "training_inquiries: anon insert"
  ON public.training_inquiries FOR INSERT TO anon
  WITH CHECK (status = 'novi');
CREATE POLICY "training_inquiries: admin full"
  ON public.training_inquiries FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- settings
CREATE POLICY "settings: public read"
  ON public.settings FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "settings: admin full"
  ON public.settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- time_blocks (no anon access; public view handles anon reads)
CREATE POLICY "time_blocks: admin full"
  ON public.time_blocks FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- push_subscriptions
CREATE POLICY "push_subscriptions: admin full"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- storage: gallery bucket
CREATE POLICY "gallery: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');
CREATE POLICY "gallery: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin());
CREATE POLICY "gallery: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin())
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin());
CREATE POLICY "gallery: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin());

-- storage: services bucket
CREATE POLICY "services: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'services');
CREATE POLICY "services: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'services' AND public.is_admin());
CREATE POLICY "services: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'services' AND public.is_admin())
  WITH CHECK (bucket_id = 'services' AND public.is_admin());
CREATE POLICY "services: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'services' AND public.is_admin());
```

- [ ] **Step 2: Reset local DB and verify migration applies**

Run: `cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && supabase db reset`

Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527000000_security_hardening.sql
git commit -m "fix(rls): replace permissive policies with admin-only access

Drop all old 'authenticated full access' policies and rebuild with
is_admin() check. Fix K1 policy name mismatch that left the original
permissive INSERT policy in place. Storage policies now also require
admin for write operations."
```

---

## Task 2: Rate Limit IP Extraction & Fail-Closed

**Fixes:** V2 (IP spoofing), V3 (fail-open on serverless)

**Files:**
- Modify: `src/lib/utils/rate-limit.ts`
- Modify: `tests/unit/rate-limit.test.ts`

- [ ] **Step 1: Write tests for getClientIp and failClosed**

Add to `tests/unit/rate-limit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

// ... existing tests stay unchanged ...

describe("getClientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const h = new Headers({
      "x-real-ip": "1.1.1.1",
      "x-forwarded-for": "9.9.9.9, 2.2.2.2",
    });
    expect(getClientIp(h)).toBe("1.1.1.1");
  });

  it("uses last entry from x-forwarded-for when x-real-ip is absent", () => {
    const h = new Headers({
      "x-forwarded-for": "spoofed, 3.3.3.3",
    });
    expect(getClientIp(h)).toBe("3.3.3.3");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const h = new Headers();
    expect(getClientIp(h)).toBe("unknown");
  });

  it("trims whitespace from IP", () => {
    const h = new Headers({ "x-forwarded-for": "  4.4.4.4  " });
    expect(getClientIp(h)).toBe("4.4.4.4");
  });
});

describe("checkRateLimit failClosed", () => {
  it("still allows requests under limit with failClosed", async () => {
    const ip = `fc-under-${Date.now()}`;
    expect(await checkRateLimit(ip, 3, 60000, { failClosed: true })).toBe(true);
  });

  it("blocks requests over limit with failClosed", async () => {
    const ip = `fc-over-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(ip, 3, 60000, { failClosed: true });
    }
    expect(await checkRateLimit(ip, 3, 60000, { failClosed: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/rate-limit.test.ts`

Expected: `getClientIp` tests fail with "getClientIp is not a function". `failClosed` tests pass (feature is additive to existing behavior).

- [ ] **Step 3: Implement getClientIp and failClosed option**

In `src/lib/utils/rate-limit.ts`, add the `getClientIp` function after the imports and update `checkRateLimit` signature:

```typescript
/**
 * Rate limiter sa Upstash Redis backend-om u produkciji,
 * in-memory fallback-om u dev/test (gdje Upstash env vars nisu setovane).
 *
 * Upstash je distribuirani — radi i na multi-region Vercel deploy-evima.
 * In-memory fallback resetuje na cold start; OK za lokalni dev i CI.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashRedis =
  upstashUrl && upstashToken
    ? new Redis({ url: upstashUrl, token: upstashToken })
    : null;

export function getClientIp(hdrs: Headers): string {
  return (
    hdrs.get("x-real-ip") ??
    hdrs.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown"
  );
}

const memStore = new Map<string, { count: number; resetAt: number }>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function memCleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) memStore.delete(key);
  }
}

function memCheck(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  memCleanup(now);
  const entry = memStore.get(ip);
  if (!entry || now > entry.resetAt) {
    memStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

const upstashCache = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!upstashRedis) return null;
  const key = `${limit}:${windowMs}`;
  const cached = upstashCache.get(key);
  if (cached) return cached;
  const seconds = Math.max(1, Math.round(windowMs / 1000));
  const limiter = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
    analytics: false,
    prefix: "up-beauty:rl",
  });
  upstashCache.set(key, limiter);
  return limiter;
}

/**
 * @returns `true` ako je zahtjev dozvoljen, `false` ako je rate-limited.
 */
export async function checkRateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  const limiter = getUpstashLimiter(limit, windowMs);
  if (limiter) {
    try {
      const { success } = await limiter.limit(ip);
      return success;
    } catch {
      if (opts?.failClosed) return false;
      return memCheck(ip, limit, windowMs);
    }
  }
  return memCheck(ip, limit, windowMs);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/rate-limit.test.ts`

Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "fix(security): add getClientIp helper and failClosed rate limit option

getClientIp prefers x-real-ip (set by Vercel, not spoofable) over
x-forwarded-for. failClosed option returns false when Upstash is
unavailable instead of falling back to per-instance in-memory store."
```

---

## Task 3: Wire getClientIp Into Availability Routes and Booking Action

**Fixes:** V2 (remaining callsites)

**Files:**
- Modify: `src/app/api/availability/route.ts:25`
- Modify: `src/app/api/availability/month/route.ts:26`
- Modify: `src/app/zakazi/actions.ts:30-31`

- [ ] **Step 1: Update availability/route.ts**

Replace line 25:
```typescript
// Old:
const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
// New:
const ip = getClientIp(new Headers(Object.fromEntries(req.headers)));
```

And add the import at the top (update the existing import line):
```typescript
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
```

Note: `req.headers` in Next.js route handlers is a `Headers` object, so pass it directly:
```typescript
const ip = getClientIp(req.headers);
```

- [ ] **Step 2: Update availability/month/route.ts**

Same change — replace line 26:
```typescript
const ip = getClientIp(req.headers);
```

Update the import:
```typescript
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
```

- [ ] **Step 3: Update zakazi/actions.ts**

Replace lines 30-31:
```typescript
// Old:
const hdrs = await headers();
const ip = hdrs.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
// New:
const hdrs = await headers();
const ip = getClientIp(hdrs);
```

Update the import:
```typescript
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
```

Also update the `checkRateLimit` call on line 32 to use `failClosed`:
```typescript
if (!(await checkRateLimit(ip, 5, 60_000, { failClosed: true }))) {
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: All 151+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/availability/route.ts src/app/api/availability/month/route.ts src/app/zakazi/actions.ts
git commit -m "fix(security): use getClientIp in all rate-limited endpoints

Replace x-forwarded-for[0] (spoofable) with getClientIp() which
prefers x-real-ip. Enable failClosed on booking action."
```

---

## Task 4: Admin Login Rate Limiting

**Fixes:** V7

**Files:**
- Create: `src/app/admin/login/actions.ts`
- Modify: `src/components/admin/LoginForm.tsx`

- [ ] **Step 1: Create login server action**

Create `src/app/admin/login/actions.ts`:

```typescript
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!(await checkRateLimit(ip, 5, 300_000, { failClosed: true }))) {
    return { ok: false, error: "Previše pokušaja. Pokušajte za 5 minuta." };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email i lozinka su obavezni" };
  }

  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "Pogrešan email ili lozinka" };
  }

  return { ok: true };
}
```

- [ ] **Step 2: Update LoginForm.tsx to use server action**

Replace the full content of `src/components/admin/LoginForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction, type LoginResult } from "@/app/admin/login/actions";

type Props = { redirectTo: string };

export function LoginForm({ redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);

        startTransition(async () => {
          const result: LoginResult = await loginAction(fd);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(redirectTo);
          router.refresh();
        });
      }}
      className="border border-cream bg-white p-6 md:p-7"
    >
      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
        />
      </div>

      <div className="mb-5">
        <label
          htmlFor="password"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
        />
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rose py-3 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Prijavljujem..." : "Prijavi se"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/login/actions.ts src/components/admin/LoginForm.tsx
git commit -m "fix(security): rate-limit admin login via server action

Move signInWithPassword from client to server action with
5 attempts / 5 minutes rate limit per IP, failClosed."
```

---

## Task 5: Fix isAdmin Check in Availability APIs

**Fixes:** V1

**Files:**
- Modify: `src/app/api/availability/route.ts:38-43`
- Modify: `src/app/api/availability/month/route.ts:39-45`

- [ ] **Step 1: Fix availability/route.ts**

Add import at top of file:
```typescript
import { isAdminEmail } from "@/lib/auth/admin-emails";
```

Replace lines 42-43:
```typescript
    // Old:
    isAdmin = !!user;
    // New:
    isAdmin = !!user && isAdminEmail(user.email);
```

- [ ] **Step 2: Fix availability/month/route.ts**

Add import at top of file:
```typescript
import { isAdminEmail } from "@/lib/auth/admin-emails";
```

Replace line 45:
```typescript
    // Old:
    isAdmin = !!user;
    // New:
    isAdmin = !!user && isAdminEmail(user.email);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/availability/route.ts src/app/api/availability/month/route.ts
git commit -m "fix(security): check isAdminEmail in availability API routes

Any authenticated user could bypass min_hours_before by passing
?admin=true. Now requires matching admin email, not just valid session."
```

---

## Task 6: Server-Side Slot Validation

**Fixes:** V8

**Files:**
- Create: `src/lib/booking/validate-slot.ts`
- Create: `tests/unit/validate-slot.test.ts`
- Modify: `src/app/zakazi/actions.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/validate-slot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isSlotWithinWorkingHours, isDateBlocked, doTimesOverlap } from "@/lib/booking/validate-slot";

describe("isSlotWithinWorkingHours", () => {
  it("returns true when slot is within open/close times", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "10:00", "11:00")).toBe(true);
  });

  it("returns false when slot starts before open time", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "08:00", "09:30")).toBe(false);
  });

  it("returns false when slot ends after close time", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "16:30", "17:30")).toBe(false);
  });

  it("returns true when slot exactly matches working hours", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "09:00", "17:00")).toBe(true);
  });
});

describe("isDateBlocked", () => {
  it("returns true when date falls within a blocked range", () => {
    expect(isDateBlocked("2026-06-15", [
      { date_from: "2026-06-10", date_to: "2026-06-20" },
    ])).toBe(true);
  });

  it("returns false when date is outside all blocked ranges", () => {
    expect(isDateBlocked("2026-06-05", [
      { date_from: "2026-06-10", date_to: "2026-06-20" },
    ])).toBe(false);
  });

  it("returns true on boundary dates (inclusive)", () => {
    expect(isDateBlocked("2026-06-10", [
      { date_from: "2026-06-10", date_to: "2026-06-10" },
    ])).toBe(true);
  });

  it("returns false when no blocked dates exist", () => {
    expect(isDateBlocked("2026-06-15", [])).toBe(false);
  });
});

describe("doTimesOverlap", () => {
  it("detects overlap", () => {
    const start = new Date("2026-06-15T10:00:00Z");
    const end = new Date("2026-06-15T11:00:00Z");
    const blocks = [
      { start: new Date("2026-06-15T10:30:00Z"), end: new Date("2026-06-15T11:30:00Z") },
    ];
    expect(doTimesOverlap(start, end, blocks)).toBe(true);
  });

  it("returns false when no overlap", () => {
    const start = new Date("2026-06-15T10:00:00Z");
    const end = new Date("2026-06-15T11:00:00Z");
    const blocks = [
      { start: new Date("2026-06-15T11:00:00Z"), end: new Date("2026-06-15T12:00:00Z") },
    ];
    expect(doTimesOverlap(start, end, blocks)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/validate-slot.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement validate-slot.ts**

Create `src/lib/booking/validate-slot.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import { TZ } from "@/lib/utils/tz";

export interface SlotValidationResult {
  valid: boolean;
  reason?: string;
}

export function isSlotWithinWorkingHours(
  openTime: string,
  closeTime: string,
  slotStart: string,
  slotEnd: string,
): boolean {
  return slotStart >= openTime && slotEnd <= closeTime;
}

export function isDateBlocked(
  dateStr: string,
  blocked: { date_from: string; date_to: string }[],
): boolean {
  return blocked.some((b) => dateStr >= b.date_from && dateStr <= b.date_to);
}

export function doTimesOverlap(
  start: Date,
  end: Date,
  blocks: { start: Date; end: Date }[],
): boolean {
  return blocks.some((b) => start < b.end && end > b.start);
}

export async function validateSlotServerSide(
  sb: SupabaseClient,
  start: Date,
  end: Date,
): Promise<SlotValidationResult> {
  const dayOfWeek = Number(formatInTimeZone(start, TZ, "e")) % 7;
  const dateStr = formatInTimeZone(start, TZ, "yyyy-MM-dd");
  const slotStartTime = formatInTimeZone(start, TZ, "HH:mm");
  const slotEndTime = formatInTimeZone(end, TZ, "HH:mm");

  const dayStart = start.toISOString();
  const dayEnd = addDays(start, 1).toISOString();

  const [hoursRes, blockedRes, timeBlocksRes] = await Promise.all([
    sb
      .from("working_hours")
      .select("open_time,close_time,is_open")
      .eq("day_of_week", dayOfWeek)
      .maybeSingle(),
    sb.from("blocked_dates").select("date_from,date_to"),
    sb
      .from("time_blocks")
      .select("start_time,end_time")
      .lt("start_time", dayEnd)
      .gt("end_time", dayStart),
  ]);

  if (hoursRes.error || blockedRes.error || timeBlocksRes.error) {
    return { valid: false, reason: "Greška pri provjeri raspoloživosti" };
  }

  const hours = hoursRes.data;
  if (!hours || !hours.is_open) {
    return { valid: false, reason: "Salon ne radi tog dana" };
  }

  if (!isSlotWithinWorkingHours(hours.open_time, hours.close_time, slotStartTime, slotEndTime)) {
    return { valid: false, reason: "Termin je van radnog vremena" };
  }

  if (isDateBlocked(dateStr, blockedRes.data ?? [])) {
    return { valid: false, reason: "Datum je blokiran" };
  }

  const blocks = (timeBlocksRes.data ?? [])
    .filter((t) => t.start_time && t.end_time)
    .map((t) => ({ start: new Date(t.start_time!), end: new Date(t.end_time!) }));

  if (doTimesOverlap(start, end, blocks)) {
    return { valid: false, reason: "Termin se preklapa sa blokirano vrijeme" };
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/validate-slot.test.ts`

Expected: ALL pass.

- [ ] **Step 5: Wire into createAppointment**

In `src/app/zakazi/actions.ts`, add import:
```typescript
import { validateSlotServerSide } from "@/lib/booking/validate-slot";
```

After the `min_hours_before` check (after line 92), add:
```typescript
  const slotCheck = await validateSlotServerSide(sb, start, end);
  if (!slotCheck.valid) {
    return { ok: false, error: slotCheck.reason ?? "Slot nije dostupan" };
  }
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/booking/validate-slot.ts tests/unit/validate-slot.test.ts src/app/zakazi/actions.ts
git commit -m "fix(security): validate booking slot against working hours and blocked dates

createAppointment now re-validates the chosen slot server-side against
working hours, blocked dates, and time blocks. Prevents bookings outside
business hours by attackers bypassing the UI."
```

---

## Task 7: Booking Client Separation (Defense-in-Depth)

**Fixes:** S1

**Files:**
- Modify: `src/app/zakazi/actions.ts`
- Modify: `src/lib/supabase/public.ts`

- [ ] **Step 1: Add .trim() to public.ts**

In `src/lib/supabase/public.ts`, change lines 24-25:

```typescript
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
```

- [ ] **Step 2: Split booking INSERT to use anon client**

In `src/app/zakazi/actions.ts`, add import:
```typescript
import { createPublicClient } from "@/lib/supabase/public";
```

Before the INSERT block (before line 120), create the anon client:
```typescript
  const anonSb = createPublicClient();
```

Change the INSERT from `sb` to `anonSb` (line 120):
```typescript
  const { data: inserted, error: insErr } = await anonSb
    .from("appointments")
    .insert({
```

Keep `sb` (admin client) for all SELECT operations (service lookup, settings, race guard, slot validation).

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm test`

Expected: No errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/zakazi/actions.ts src/lib/supabase/public.ts
git commit -m "fix(security): use anon client for booking INSERT (defense-in-depth)

The booking INSERT now goes through the anon Supabase client, so the RLS
constraint (status='ceka', confirmation_sent_at IS NULL) is enforced at
the database level. Admin client is still used for SELECT operations
that require cross-user data access."
```

---

## Task 8: HTTP Security Headers

**Fixes:** V4 (CSP enforced), V5 (HSTS), S3 (body size limit)

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update next.config.ts**

Three changes in `next.config.ts`:

1. Line 28 — change `Content-Security-Policy-Report-Only` to `Content-Security-Policy`:
```typescript
            key: "Content-Security-Policy",
```

2. Add HSTS header after the Permissions-Policy entry (after line 26):
```typescript
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
```

3. Line 68 — change body size limit:
```typescript
      bodySizeLimit: "6mb",
```

- [ ] **Step 2: Run build to verify no header issues**

Run: `npm run build`

Expected: Build succeeds. (CSP with `unsafe-inline` may show warnings but won't block.)

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix(security): enforce CSP, add HSTS, reduce body size limit

Switch CSP from Report-Only to enforced. Add Strict-Transport-Security
header. Reduce server actions body size from 10MB to 6MB."
```

---

## Task 9: CSV Formula Injection Protection

**Fixes:** V6

**Files:**
- Modify: `src/lib/utils/csv.ts`
- Modify: `tests/unit/csv.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/csv.test.ts` inside the `csvEscape` describe block:

```typescript
  it("prefixes formula characters with apostrophe to prevent injection", () => {
    expect(csvEscape("=1+1")).toBe("\"'=1+1\"");
    expect(csvEscape("+1+1")).toBe("\"'+1+1\"");
    expect(csvEscape("-1+1")).toBe("\"'-1+1\"");
    expect(csvEscape("@SUM(A1:A10)")).toBe("\"'@SUM(A1:A10)\"");
    expect(csvEscape("\tcmd")).toBe("\"'\tcmd\"");
    expect(csvEscape("\rcmd")).toBe("\"'\rcmd\"");
  });

  it("does not prefix normal strings that happen to contain formula chars mid-string", () => {
    expect(csvEscape("termin za +387")).toBe("termin za +387");
    expect(csvEscape("email@test.com")).toBe("email@test.com");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/csv.test.ts`

Expected: "prefixes formula characters" test FAILS.

- [ ] **Step 3: Add formula injection protection**

In `src/lib/utils/csv.ts`, update `csvEscape`:

```typescript
export function csvEscape(value: CsvCell): string {
  if (value == null) return "";
  const s = String(value);
  if (s === "") return "";
  if (/^[=+\-@\t\r]/.test(s)) {
    return `"'${s.replace(/"/g, '""')}"`;
  }
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/csv.test.ts`

Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/csv.ts tests/unit/csv.test.ts
git commit -m "fix(security): prevent CSV formula injection in exports

Prefix cells starting with =, +, -, @, tab, or CR with an apostrophe.
Excel treats the apostrophe as a text-prefix marker."
```

---

## Task 10: Error Message Sanitization in API Routes

**Fixes:** N1

**Files:**
- Modify: `src/app/api/availability/route.ts`
- Modify: `src/app/api/availability/month/route.ts`

- [ ] **Step 1: Update availability/route.ts**

Add import:
```typescript
import { sanitizeError } from "@/lib/utils/log";
```

Replace all error response patterns (lines 75-76, 108-127). For each `error.message` return, change to:

```typescript
  if (serviceError) {
    console.error("service query failed:", sanitizeError(serviceError));
    return NextResponse.json({ error: "Greška pri učitavanju podataka" }, { status: 500 });
  }
```

Apply same pattern to all five error checks (`serviceError`, `apptRes.error`, `blockedRes.error`, `hoursRes.error`, `timeBlocksRes.error`, `settingsRes.error`). Each should log the sanitized error and return the generic message.

- [ ] **Step 2: Update availability/month/route.ts**

Same changes — add `sanitizeError` import, replace all `error.message` responses with generic message + server-side log.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/availability/route.ts src/app/api/availability/month/route.ts
git commit -m "fix(security): sanitize error messages in public API routes

Replace raw Supabase error.message with generic client message.
Log the actual error server-side via sanitizeError()."
```

---

## Task 11: Env Var Trimming

**Fixes:** S7

**Files:**
- Modify: `src/lib/supabase/admin.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/supabase/client.ts`

(`public.ts` was already fixed in Task 7)

- [ ] **Step 1: Update admin.ts**

Change lines 11-12:
```typescript
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
```

- [ ] **Step 2: Update server.ts**

Change lines 11-12:
```typescript
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
```

- [ ] **Step 3: Update client.ts**

Change lines 9-10:
```typescript
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/supabase/server.ts src/lib/supabase/client.ts
git commit -m "fix(security): trim env vars in all Supabase client factories

Vercel env vars have trailing newlines that cause silent auth failures.
Apply .trim() to all SUPABASE_URL and key reads."
```

---

## Task 12: Miscellaneous Low-Severity Fixes

**Fixes:** N3 (ICS UID), N5 (.env.example email), N6 (Math.random), N7 (missing requireAdmin), S6 (dev binding)

**Files:**
- Modify: `src/lib/notifications/send-admin-email.ts:34`
- Modify: `.env.example:9`
- Modify: `src/app/admin/(protected)/galerija/actions.ts:91`
- Modify: `src/app/admin/(protected)/postavke/email-actions.ts:98`
- Modify: `package.json:6`

- [ ] **Step 1: Fix ICS UID (N3)**

In `src/lib/notifications/send-admin-email.ts`, line 34, change:
```typescript
      uid: `appt-${input.appointmentId}@upmakeup.ba`,
```

- [ ] **Step 2: Fix .env.example email (N5)**

In `.env.example`, line 9, change:
```
ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

- [ ] **Step 3: Fix Math.random filename (N6)**

In `src/app/admin/(protected)/galerija/actions.ts`, line 91, change:
```typescript
    const random = crypto.randomUUID().slice(0, 8);
```

- [ ] **Step 4: Add requireAdmin to getEmailNotificationConfig (N7)**

In `src/app/admin/(protected)/postavke/email-actions.ts`, add at the beginning of `getEmailNotificationConfig()` (after line 98, before line 99):

```typescript
export async function getEmailNotificationConfig(): Promise<{
  configured: boolean;
  recipientPreview: string | null;
}> {
  await requireAdmin();

  const apiKey = process.env.RESEND_API_KEY;
```

- [ ] **Step 5: Fix dev script binding (S6)**

In `package.json`, line 6, change:
```json
    "dev": "next dev",
```

- [ ] **Step 6: Run typecheck and tests**

Run: `npm run typecheck && npm test`

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/notifications/send-admin-email.ts .env.example src/app/admin/\(protected\)/galerija/actions.ts src/app/admin/\(protected\)/postavke/email-actions.ts package.json
git commit -m "fix(security): miscellaneous low-severity fixes

- ICS UID uses appointmentId instead of timestamp (prevents collisions)
- .env.example uses placeholder email instead of real personal email
- Gallery filenames use crypto.randomUUID instead of Math.random
- getEmailNotificationConfig now requires admin auth
- Dev server no longer binds to 0.0.0.0"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: All tests pass (including new tests from Tasks 2, 6, 9).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: No errors.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Reset local Supabase and verify migration**

Run: `supabase db reset`

Expected: All migrations apply cleanly. The new `is_admin()` function and policies are created.

---

## Task 14: Secret Rotation (Manual)

**Fixes:** K4

This task requires manual action in external dashboards. Not automatable.

- [ ] **Step 1: Rotate Supabase service_role key**

Go to Supabase Dashboard → Project Settings → API → Regenerate service_role key.

- [ ] **Step 2: Rotate Resend API key**

Go to Resend Dashboard → API Keys → Revoke `re_NjErGhYA_...` → Create new key.

- [ ] **Step 3: Update Vercel env vars**

Go to Vercel Dashboard → Project Settings → Environment Variables:
- Update `SUPABASE_SERVICE_ROLE_KEY` with the new key (no trailing newline)
- Update `RESEND_API_KEY` with the new key
- Check/fix trailing `\n` on ALL other env vars

- [ ] **Step 4: Delete local production env file**

```bash
rm -f "/Users/nmil/Desktop/Una Peranovic/up-beauty/.vercel/.env.production.local"
```

- [ ] **Step 5: Verify production after redeploy**

Vercel auto-redeploys when env vars change. Verify:
- Public pages load correctly
- Booking flow works
- Admin login works
- Email notifications work (send test from admin panel)
