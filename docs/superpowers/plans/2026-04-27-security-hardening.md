# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adresirati sve sigurnosne nalaze iz audita od 2026-04-27 osim rotacije Supabase ključeva (rotacija je odložena za handover Uni).

**Architecture:** Tri pravca: (1) defense-in-depth na auth slojevima (centralizacija admin lista, requireAdmin u layout-u, validacija redirect parametra), (2) data privacy (sanitize PII logova, sakri `time_blocks.reason` od anon role-a kroz VIEW, dodaj storage bucket policies u migracije), (3) production hardening (Upstash rate limit, CSP header).

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, `@upstash/ratelimit` + `@upstash/redis`, Vitest (unit), Playwright (E2E).

**Source audit:** Svi nalazi referenciraju razgovor od 2026-04-27 (sigurnosni audit). Rotacija ključeva (`C1`) NIJE u ovom planu — rješava se neposredno pred handover.

---

## File Structure

**New files:**
- `src/lib/auth/admin-emails.ts` — single source za listu admin email-ova
- `src/lib/utils/log.ts` — `sanitizeError()` helper, sprječava PII curenje u logovima
- `src/lib/utils/safe-redirect.ts` — `safeRedirect()` helper, validira `?redirect=` parametar
- `supabase/migrations/20260427000000_time_blocks_public_view.sql` — VIEW koji sakriva `reason` od anon role-a
- `supabase/migrations/20260427000001_storage_policies.sql` — eksplicitne storage policies za `gallery` bucket
- `tests/unit/log.test.ts` — testovi za `sanitizeError()`
- `tests/unit/safe-redirect.test.ts` — testovi za `safeRedirect()`
- `tests/unit/admin-emails.test.ts` — sanity test da centralizovana lista sadrži očekivane email-ove
- `tests/e2e/security-headers.spec.ts` — provjera CSP header-a
- `tests/e2e/admin-layout-guard.spec.ts` — non-admin user ne prolazi layout
- `tests/e2e/time-blocks-privacy.spec.ts` — anon ne može pročitati `reason`
- `tests/e2e/open-redirect.spec.ts` — login odbija external redirect

**Modified files:**
- `src/proxy.ts:5-8` — import `ADMIN_EMAILS` iz novog modula
- `src/lib/supabase/require-admin.ts:6-9` — import `ADMIN_EMAILS` iz novog modula
- `src/app/admin/(protected)/layout.tsx:15-22` — koristiti `requireAdmin()` umjesto plain `getUser()`
- `src/app/admin/login/page.tsx:14, 34` — primijeniti `safeRedirect()` na query param
- `src/app/zakazi/actions.ts:96, 126` — koristiti `sanitizeError()` u `console.error`
- `src/app/admin/(protected)/galerija/actions.ts:92, 108` — isto
- `src/app/api/availability/route.ts:99-103` — query VIEW `time_blocks_public` umjesto direktne tabele
- `src/lib/utils/rate-limit.ts` — refactor na Upstash sa fallback-om na in-memory za dev/test
- `next.config.ts:11-15` — dodati CSP header (Report-Only u prvoj iteraciji)
- `.env.example` — dokumentovati `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `package.json` — dodati `@upstash/ratelimit` i `@upstash/redis`

---

## Task 1: Centralizovati ADMIN_EMAILS

**Files:**
- Create: `src/lib/auth/admin-emails.ts`
- Modify: `src/proxy.ts:5-8`
- Modify: `src/lib/supabase/require-admin.ts:6-9`
- Test: `tests/unit/admin-emails.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/admin-emails.test.ts
import { describe, it, expect } from "vitest";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/auth/admin-emails";

describe("admin-emails", () => {
  it("contains the production admin", () => {
    expect(ADMIN_EMAILS.has("peranovicuna6@gmail.com")).toBe(true);
  });

  it("isAdminEmail accepts a known admin", () => {
    expect(isAdminEmail("peranovicuna6@gmail.com")).toBe(true);
  });

  it("isAdminEmail rejects a random email", () => {
    expect(isAdminEmail("attacker@evil.com")).toBe(false);
  });

  it("isAdminEmail rejects undefined and empty string", () => {
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null as unknown as string)).toBe(false);
  });

  it("test admin user is only present when ADMIN_EMAILS_EXTRA env var is set", () => {
    // In production bundle, test@admin.com must NOT be present.
    // The test environment loads it via env var injection (see vitest.config setup).
    if (!process.env.ADMIN_EMAILS_EXTRA) {
      expect(ADMIN_EMAILS.has("test@admin.com")).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- admin-emails`
Expected: FAIL — module not found

- [ ] **Step 3: Create the centralized module**

```ts
// src/lib/auth/admin-emails.ts
/**
 * Single source of truth za listu admin email-ova.
 * Importovati iz src/proxy.ts i src/lib/supabase/require-admin.ts.
 *
 * Test admin (test@admin.com) NIJE u prod bundle-u — dodaje se samo
 * kroz ADMIN_EMAILS_EXTRA env var u .env.test (postavlja test:setup skripta).
 */
const baseAdmins = ["peranovicuna6@gmail.com"] as const;

const extras = (process.env.ADMIN_EMAILS_EXTRA ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const ADMIN_EMAILS = new Set<string>([
  ...baseAdmins.map((s) => s.toLowerCase()),
  ...extras,
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- admin-emails`
Expected: PASS

- [ ] **Step 5: Update `src/proxy.ts` to use centralized module**

Replace lines 1-8:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/auth/admin-emails";
```

Replace line 43 (`if (!user || !ADMIN_EMAILS.has(user.email ?? ""))`):
```ts
    if (!user || !isAdminEmail(user.email)) {
```

- [ ] **Step 6: Update `src/lib/supabase/require-admin.ts` to use centralized module**

Replace lines 1-9:
```ts
"use server";

import { createClient } from "./server";
import { isAdminEmail } from "@/lib/auth/admin-emails";
```

Replace line 24 (`if (!ADMIN_EMAILS.has(user.email ?? ""))`):
```ts
  if (!isAdminEmail(user.email)) {
```

- [ ] **Step 7: Update test setup to inject `ADMIN_EMAILS_EXTRA`**

Modify `scripts/setup-test-env.sh` — add to the `.env.test` HEREDOC block (after `E2E_ADMIN_PASSWORD=Test1234A`):

```bash
ADMIN_EMAILS_EXTRA=test@admin.com
```

- [ ] **Step 8: Run typecheck and full unit suite**

Run: `npm run typecheck && npm test`
Expected: PASS — both proxy and require-admin still compile, unit tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth/admin-emails.ts src/proxy.ts src/lib/supabase/require-admin.ts tests/unit/admin-emails.test.ts scripts/setup-test-env.sh
git commit -m "refactor(auth): centralizuj ADMIN_EMAILS u jedan modul, izbaci test@admin.com iz prod bundle"
```

---

## Task 2: Sanitize PII u logovima

**Files:**
- Create: `src/lib/utils/log.ts`
- Modify: `src/app/zakazi/actions.ts:96, 126`
- Modify: `src/app/admin/(protected)/galerija/actions.ts:92, 108`
- Test: `tests/unit/log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/log.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeError } from "@/lib/utils/log";

describe("sanitizeError", () => {
  it("returns code and short message for Postgres errors", () => {
    const pgErr = {
      code: "23505",
      message: "duplicate key value violates unique constraint \"appointments_pkey\"",
      details: "Key (client_phone)=(+38765123456) already exists.",
      hint: null,
    };
    const out = sanitizeError(pgErr);
    expect(out.code).toBe("23505");
    expect(out.message).toBe("duplicate key value violates unique constraint");
    // Critical: details with PII MUST be dropped
    expect(JSON.stringify(out)).not.toContain("38765");
    expect(JSON.stringify(out)).not.toContain("client_phone");
  });

  it("truncates message to 80 chars", () => {
    const err = { message: "a".repeat(500) };
    expect(sanitizeError(err).message?.length).toBeLessThanOrEqual(80);
  });

  it("handles plain Error objects", () => {
    const err = new Error("network failure");
    const out = sanitizeError(err);
    expect(out.message).toBe("network failure");
    expect(out.code).toBeUndefined();
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeError(null)).toEqual({ code: undefined, message: "unknown error" });
    expect(sanitizeError(undefined)).toEqual({ code: undefined, message: "unknown error" });
  });

  it("strips email-shaped strings from the message", () => {
    const err = { message: "Insert failed for user@example.com on row 5" };
    expect(sanitizeError(err).message).not.toContain("@example.com");
  });

  it("strips phone-shaped strings from the message", () => {
    const err = { message: "Number +38765123456 is invalid" };
    const out = sanitizeError(err);
    expect(out.message).not.toContain("38765");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- log.test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `sanitizeError`**

```ts
// src/lib/utils/log.ts
/**
 * Skida PII iz error objekata prije slanja u console.
 * Postgres error-i mogu sadržati telefon/email u `details` polju kroz
 * unique constraint violation poruke. Vercel runtime logovi su retained
 * mjesecima i vidljivi cijelom team-u — ne smije curiti PII tu.
 */

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /[+]?\d[\d\s().-]{6,}\d/g;

export function sanitizeError(err: unknown): {
  code: string | undefined;
  message: string;
} {
  if (err == null) {
    return { code: undefined, message: "unknown error" };
  }

  const obj = err as { code?: unknown; message?: unknown };
  const code = typeof obj.code === "string" ? obj.code : undefined;

  let raw =
    typeof obj.message === "string"
      ? obj.message
      : err instanceof Error
        ? err.message
        : "unknown error";

  raw = raw.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
  if (raw.length > 80) raw = raw.slice(0, 80);

  return { code, message: raw };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- log.test`
Expected: PASS

- [ ] **Step 5: Apply `sanitizeError` in `src/app/zakazi/actions.ts`**

Add import after line 10 (`import { checkRateLimit } from "@/lib/utils/rate-limit";`):

```ts
import { sanitizeError } from "@/lib/utils/log";
```

Replace line 96 (`console.error("race-guard query failed:", clashErr);`):

```ts
    console.error("race-guard query failed:", sanitizeError(clashErr));
```

Replace line 126 (`console.error("appointment insert failed:", insErr);`):

```ts
    console.error("appointment insert failed:", sanitizeError(insErr));
```

- [ ] **Step 6: Apply `sanitizeError` in `src/app/admin/(protected)/galerija/actions.ts`**

Add import after `import { createAdminClient } from "@/lib/supabase/admin";`:

```ts
import { sanitizeError } from "@/lib/utils/log";
```

Replace line 92 (`console.error("upload failed:", uploadErr);`):

```ts
      console.error("upload failed:", sanitizeError(uploadErr));
```

Replace line 108 (`console.error("insert failed:", insertErr);`):

```ts
      console.error("insert failed:", sanitizeError(insertErr));
```

- [ ] **Step 7: Run full unit suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/log.ts src/app/zakazi/actions.ts src/app/admin/\(protected\)/galerija/actions.ts tests/unit/log.test.ts
git commit -m "fix(security): sanitize PII iz console.error logova (zakazi + galerija)"
```

---

## Task 3: Validacija redirect parametra na login-u

**Files:**
- Create: `src/lib/utils/safe-redirect.ts`
- Modify: `src/app/admin/login/page.tsx:14, 34`
- Test: `tests/unit/safe-redirect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/safe-redirect.test.ts
import { describe, it, expect } from "vitest";
import { safeRedirect } from "@/lib/utils/safe-redirect";

describe("safeRedirect", () => {
  const fallback = "/admin/dashboard";

  it("accepts a same-origin path", () => {
    expect(safeRedirect("/admin/termini", fallback)).toBe("/admin/termini");
  });

  it("accepts a path with query string", () => {
    expect(safeRedirect("/admin/termini?status=ceka", fallback)).toBe(
      "/admin/termini?status=ceka",
    );
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirect("https://evil.com", fallback)).toBe(fallback);
    expect(safeRedirect("http://evil.com/path", fallback)).toBe(fallback);
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.com", fallback)).toBe(fallback);
    expect(safeRedirect("//evil.com/path", fallback)).toBe(fallback);
  });

  it("rejects backslash variant (some browsers normalize)", () => {
    expect(safeRedirect("/\\evil.com", fallback)).toBe(fallback);
    expect(safeRedirect("\\\\evil.com", fallback)).toBe(fallback);
  });

  it("rejects javascript: and data: schemes", () => {
    expect(safeRedirect("javascript:alert(1)", fallback)).toBe(fallback);
    expect(safeRedirect("data:text/html,<script>", fallback)).toBe(fallback);
  });

  it("returns fallback for undefined / empty / non-string input", () => {
    expect(safeRedirect(undefined, fallback)).toBe(fallback);
    expect(safeRedirect("", fallback)).toBe(fallback);
    expect(safeRedirect(null as unknown as string, fallback)).toBe(fallback);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- safe-redirect`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `safeRedirect`**

```ts
// src/lib/utils/safe-redirect.ts
/**
 * Vraća `target` samo ako je relativan path na istom origin-u.
 * Inače vraća `fallback`. Sprječava open-redirect phishing.
 */
export function safeRedirect(
  target: string | null | undefined,
  fallback: string,
): string {
  if (typeof target !== "string" || target.length === 0) return fallback;
  // Mora počinjati sa "/"
  if (!target.startsWith("/")) return fallback;
  // Odbij protocol-relative ("//evil.com") i backslash varijantu ("/\evil.com")
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  // Odbij sve sa schemeom (javascript:, data:, http:, ...)
  if (/^[a-z][a-z0-9+.-]*:/i.test(target.slice(1))) return fallback;
  return target;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- safe-redirect`
Expected: PASS

- [ ] **Step 5: Apply `safeRedirect` in `src/app/admin/login/page.tsx`**

Replace lines 1-14:

```tsx
import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { safeRedirect } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = {
  title: "Prijava — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const safe = safeRedirect(redirect, "/admin/dashboard");
```

Replace line 34 (`<LoginForm redirectTo={redirect ?? "/admin/dashboard"} />`):

```tsx
        <LoginForm redirectTo={safe} />
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils/safe-redirect.ts src/app/admin/login/page.tsx tests/unit/safe-redirect.test.ts
git commit -m "fix(security): validiraj ?redirect= parametar na login-u (open redirect)"
```

---

## Task 4: requireAdmin u protected layout-u

**Files:**
- Modify: `src/app/admin/(protected)/layout.tsx:15-22`
- Test: `tests/e2e/admin-layout-guard.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

```ts
// tests/e2e/admin-layout-guard.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
const NON_ADMIN_EMAIL = "non-admin-test@example.com";
const NON_ADMIN_PASSWORD = "Test1234A";

test.describe("admin layout guard", () => {
  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey);
    // Idempotently create a non-admin user
    await admin.auth.admin.createUser({
      email: NON_ADMIN_EMAIL,
      password: NON_ADMIN_PASSWORD,
      email_confirm: true,
    });
  });

  test.afterAll(async () => {
    const admin = createClient(url, serviceKey);
    const { data } = await admin.auth.admin.listUsers();
    const u = data.users.find((x) => x.email === NON_ADMIN_EMAIL);
    if (u) await admin.auth.admin.deleteUser(u.id);
  });

  test("non-admin authenticated user is redirected from /admin/dashboard", async ({
    page,
  }) => {
    // Sign in as non-admin via Supabase REST (skipping the login UI guard which
    // already rejects via proxy — we want to test the layout fallback in isolation)
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', NON_ADMIN_EMAIL);
    await page.fill('input[name="password"]', NON_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // The proxy will already redirect non-admins back to login.
    // Layout fallback would only matter if proxy ever bypassed; we assert
    // the user CANNOT reach the dashboard regardless.
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/admin/login");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e:local -- admin-layout-guard`
Expected: PASS — proxy already blocks. (Layout change is defense-in-depth; this test asserts current+future behavior consistent.)

If test fails because non-admin reaches dashboard, that confirms the layout gap.

- [ ] **Step 3: Update layout to use `requireAdmin`**

Replace `src/app/admin/(protected)/layout.tsx` entirely:

```tsx
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin-emails";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Layout za sve zaštićene admin rute. Koristi route group `(protected)`
 * tako da `/admin/login` ne nasljeđuje shell niti auth provjeru.
 *
 * Defense-in-depth: i ako proxy ikad bude bypass-ovan (npr. nova ruta zaboravi
 * matcher), layout sam provjerava i `user` i admin email.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/admin/login");
  }

  return <AdminShell userEmail={user.email ?? null}>{children}</AdminShell>;
}
```

(Ne pozivamo `requireAdmin()` direktno jer ono baca grešku — u layout-u treba `redirect()`. Koristimo `isAdminEmail()` iz Task 1.)

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e:local -- admin-layout-guard`
Expected: PASS

- [ ] **Step 5: Run full E2E suite to verify no regressions**

Run: `npm run test:e2e:local`
Expected: PASS — admin login + manual booking + ostali admin testovi i dalje rade za pravog admina.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/\(protected\)/layout.tsx tests/e2e/admin-layout-guard.spec.ts
git commit -m "fix(security): admin layout provjerava i admin email, ne samo user (defense-in-depth)"
```

---

## Task 5: Sakri `time_blocks.reason` od anon role-a

**Files:**
- Create: `supabase/migrations/20260427000000_time_blocks_public_view.sql`
- Modify: `src/app/api/availability/route.ts:99-103`
- Test: `tests/e2e/time-blocks-privacy.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

```ts
// tests/e2e/time-blocks-privacy.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe("time_blocks privacy", () => {
  let createdId: number | null = null;

  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey);
    // Seed a time block sa osjetljivim reason-om
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(11, 0, 0, 0);

    const { data, error } = await admin
      .from("time_blocks")
      .insert({
        start_time: tomorrow.toISOString(),
        end_time: end.toISOString(),
        reason: "E2E_TEST_PRIVATE_ZUBAR",
      })
      .select("id")
      .single();
    if (error) throw error;
    createdId = data.id;
  });

  test.afterAll(async () => {
    if (createdId == null) return;
    const admin = createClient(url, serviceKey);
    await admin.from("time_blocks").delete().eq("id", createdId);
  });

  test("anon SELECT na time_blocks ne vraća reason kolonu", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon
      .from("time_blocks")
      .select("reason")
      .eq("id", createdId!);
    // Očekujemo ili explicit deny (error) ili praznu kolonu reason.
    // Strogo: novi VIEW pristup znači da `time_blocks` direktan SELECT vraća error za anon.
    expect(error || (data && data.every((r) => !("reason" in r)))).toBeTruthy();
  });

  test("anon može pročitati start_time/end_time kroz public view", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon
      .from("time_blocks_public")
      .select("start_time,end_time")
      .gte("start_time", new Date().toISOString());
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e:local -- time-blocks-privacy`
Expected: FAIL — `time_blocks_public` ne postoji još, i anon vidi `reason` na direktnoj tabeli.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260427000000_time_blocks_public_view.sql
-- Sakri reason kolonu od anon role-a kroz dedicated VIEW.
-- Razlog: reason može sadržavati privatne info ("zubar", "privatno"...).
-- Anon ključ je u browser bundle-u — bilo ko može direkt query-jati REST API.

-- 1. Drop public SELECT na sirovoj tabeli
DROP POLICY IF EXISTS "time_blocks: public read" ON public.time_blocks;

-- 2. Authenticated (admin) i dalje ima pun pristup (postojeći policy)
-- "time_blocks: authenticated full access" ostaje netaknut.

-- 3. Public-safe view
CREATE OR REPLACE VIEW public.time_blocks_public AS
  SELECT id, start_time, end_time
  FROM public.time_blocks;

-- 4. Grant na view
GRANT SELECT ON public.time_blocks_public TO anon;
GRANT SELECT ON public.time_blocks_public TO authenticated;

-- 5. Revoke direktan SELECT na sirovoj tabeli za anon
REVOKE SELECT ON public.time_blocks FROM anon;

COMMENT ON VIEW public.time_blocks_public IS
  'Public-safe projection of time_blocks (skriva reason). Koristi se u /api/availability.';
```

- [ ] **Step 4: Apply migration locally**

Run: `supabase db reset` (resetuje lokalnu Docker bazu i primjenjuje sve migracije)
Expected: success, sve migracije primijenjene.

- [ ] **Step 5: Update `src/app/api/availability/route.ts` da query-uje view**

Replace lines 99-103:

```ts
      sb
        .from("time_blocks_public")
        .select("start_time,end_time")
        .lt("start_time", dayEnd)
        .gt("end_time", dayStart),
```

(Napomena: ova ruta koristi service-role klijent koji bypass-uje RLS, ali koristimo view radi semantičke konzistentnosti — view eksplicitno definiše šta je "public" projekcija.)

- [ ] **Step 6: Generate updated TS types**

Run: `supabase gen types typescript --local > src/types/database.ts`
Expected: `database.ts` se update-uje da uključuje `time_blocks_public` view.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Run E2E test**

Run: `npm run test:e2e:local -- time-blocks-privacy`
Expected: PASS

- [ ] **Step 9: Run full E2E suite za regressions (booking flow zavisi od availability)**

Run: `npm run test:e2e:local`
Expected: PASS — booking flow i admin time blocks i dalje rade.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260427000000_time_blocks_public_view.sql src/app/api/availability/route.ts src/types/database.ts tests/e2e/time-blocks-privacy.spec.ts
git commit -m "fix(security): sakri time_blocks.reason od anon kroz public view"
```

---

## Task 6: Storage bucket policies u migracijama

**Files:**
- Create: `supabase/migrations/20260427000001_storage_policies.sql`

- [ ] **Step 1: Provjeri trenutno stanje policies kroz Supabase MCP**

Akcija (manuelno ili kroz mcp__supabase__execute_sql):

```sql
SELECT * FROM storage.policies WHERE bucket_id = 'gallery';
SELECT id, name, public FROM storage.buckets WHERE id = 'gallery';
```

Zabilježi sve postojeće policies — migracija ih mora rekreirati identično (ili eksplicitno ispraviti).

- [ ] **Step 2: Napiši migraciju koja čini Supabase dashboard config reproducibilnim**

```sql
-- supabase/migrations/20260427000001_storage_policies.sql
-- Eksplicitne storage policies za `gallery` bucket.
-- Prethodno postavljene kroz Supabase dashboard manualno — ovo ih čini
-- reproducibilnim i code-review-ovanim.

-- Idempotent: bucket je već kreiran kroz dashboard, ovo samo osigurava da je public read.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('gallery', 'gallery', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop sve postojeće policies za gallery (rekreiramo eksplicitno)
DROP POLICY IF EXISTS "gallery: public read" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated delete" ON storage.objects;

-- Public može čitati slike (galerija je javna)
CREATE POLICY "gallery: public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'gallery');

-- Samo authenticated (admin) može upload-ovati nove fajlove
CREATE POLICY "gallery: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery');

-- Samo authenticated može menjati postojeće fajlove
CREATE POLICY "gallery: authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery')
  WITH CHECK (bucket_id = 'gallery');

-- Samo authenticated može brisati
CREATE POLICY "gallery: authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery');
```

- [ ] **Step 3: Apply migration locally**

Run: `supabase db reset`
Expected: success.

- [ ] **Step 4: Run full E2E suite**

Run: `npm run test:e2e:local`
Expected: PASS — gallery upload i admin galerija test i dalje rade.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260427000001_storage_policies.sql
git commit -m "chore(security): premjestiti gallery bucket policies u migracije"
```

---

## Task 7: Replace in-memory rate-limit sa Upstash + in-memory fallback

**Files:**
- Modify: `src/lib/utils/rate-limit.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `tests/unit/rate-limit.test.ts` (verify in-memory fallback path still works)

- [ ] **Step 1: Install dependencies**

Run: `npm install @upstash/ratelimit @upstash/redis`
Expected: instalirano. Provjeri `package.json` dependency listu.

- [ ] **Step 2: Read existing test to understand contract**

Run: `cat tests/unit/rate-limit.test.ts`
Expected: postojeći testovi koriste `checkRateLimit(ip, limit, windowMs)` i očekuju boolean.

Ažuriraj test (ako treba) — funkcija postaje async ali u dev/test (bez Upstash env vars) treba i dalje da radi sinhrono kroz fallback. **Ne mijenjaj API:** zadrži `checkRateLimit` kao async funkciju (koja je već awaitable u svim postojećim pozivima).

Provjeri callsite-ove:
- `src/app/zakazi/actions.ts:24` — već je `if (!checkRateLimit(...))`. Postaje `if (!(await checkRateLimit(...)))`.
- `src/app/api/availability/route.ts:26` — isto.

- [ ] **Step 3: Refactor `src/lib/utils/rate-limit.ts`**

```ts
// src/lib/utils/rate-limit.ts
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

// Cache Ratelimit instances by (limit, windowMs) — Upstash creates a new
// sliding window per instance.
const upstashCache = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!upstashUrl || !upstashToken) return null;
  const key = `${limit}:${windowMs}`;
  const cached = upstashCache.get(key);
  if (cached) return cached;
  const redis = new Redis({ url: upstashUrl, token: upstashToken });
  const seconds = Math.max(1, Math.round(windowMs / 1000));
  const limiter = new Ratelimit({
    redis,
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
): Promise<boolean> {
  const limiter = getUpstashLimiter(limit, windowMs);
  if (limiter) {
    try {
      const { success } = await limiter.limit(ip);
      return success;
    } catch {
      // Ako Upstash padne, fail-open NA fallback (ne fail-closed da ne blokiraš sve real requestove)
      return memCheck(ip, limit, windowMs);
    }
  }
  return memCheck(ip, limit, windowMs);
}
```

- [ ] **Step 4: Update postojeći unit test za async API**

Modify `tests/unit/rate-limit.test.ts` — wrap calls u `await`:

Pronađi sve `checkRateLimit(...)` pozive u testu i prefiksuj sa `await`. Dodaj `async` na test funkcije gdje treba.

Primjer izmjene jedne it-blokade:

```ts
// Prije
it("allows first request", () => {
  expect(checkRateLimit("ip-1", 5, 60_000)).toBe(true);
});

// Poslije
it("allows first request", async () => {
  expect(await checkRateLimit("ip-1", 5, 60_000)).toBe(true);
});
```

(Bez Upstash env vars u test okruženju, fallback path pokriva isto ponašanje.)

- [ ] **Step 5: Update callsite-ove u app kodu**

Modify `src/app/zakazi/actions.ts:24`:

```ts
  if (!(await checkRateLimit(ip, 5, 60_000))) {
```

Modify `src/app/api/availability/route.ts:26`:

```ts
  if (!(await checkRateLimit(ip, 30, 60_000))) {
```

- [ ] **Step 6: Update `.env.example`**

Append to `.env.example`:

```
# Upstash Redis (rate limiting). Optional — bez ovih var-i koristi se in-memory fallback (dev/test).
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 7: Run unit testove**

Run: `npm test -- rate-limit`
Expected: PASS — fallback path radi.

- [ ] **Step 8: Run typecheck + full unit suite**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 9: Run E2E za sigurnost (booking flow koristi rate limit)**

Run: `npm run test:e2e:local`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/utils/rate-limit.ts src/app/zakazi/actions.ts src/app/api/availability/route.ts tests/unit/rate-limit.test.ts package.json package-lock.json .env.example
git commit -m "feat(security): Upstash rate limit sa in-memory fallback (Vercel multi-region safe)"
```

---

## Task 8: CSP header (Report-Only u prvoj iteraciji)

**Files:**
- Modify: `next.config.ts:11-15`
- Test: `tests/e2e/security-headers.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

```ts
// tests/e2e/security-headers.spec.ts
import { test, expect } from "@playwright/test";

test.describe("security headers", () => {
  test("homepage emits CSP report-only header", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy-report-only"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    // Supabase storage domena mora biti u img-src
    expect(csp).toContain("img-src");
  });

  test("homepage emits standard hardening headers", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
```

- [ ] **Step 2: Run test to verify CSP test fails**

Run: `npm run test:e2e:local -- security-headers`
Expected: FAIL — CSP header ne postoji.

- [ ] **Step 3: Add CSP header u `next.config.ts`**

Replace lines 11-15 (postojeći headers array):

```ts
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              // Next.js inline runtime zahtijeva 'unsafe-inline' do nonce setup-a.
              // Report-only za sad — pratimo violations prije enforce.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://${supabaseHostname}`,
              `connect-src 'self' https://${supabaseHostname} wss://${supabaseHostname}`,
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
```

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e:local -- security-headers`
Expected: PASS

- [ ] **Step 5: Manual smoke test — open homepage in browser**

Run: `npm run dev` u jednom tab-u, posjeti http://localhost:3000 u browser-u.
Otvori DevTools → Console.
Expected: nema CSP **enforcement** error-a (Report-Only mode); ako ima `Report-Only` upozorenja, zabilježiti za buduću iteraciju kad se prebaci na `Content-Security-Policy` (enforce).

- [ ] **Step 6: Commit**

```bash
git add next.config.ts tests/e2e/security-headers.spec.ts
git commit -m "feat(security): dodaj CSP Report-Only header (osnova za enforce u sljedećoj iteraciji)"
```

---

## Task 9: Open-redirect E2E coverage

**Files:**
- Test: `tests/e2e/open-redirect.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/open-redirect.spec.ts
import { test, expect } from "@playwright/test";

test.describe("login open-redirect protection", () => {
  test("?redirect=https://evil.com is sanitized to /admin/dashboard", async ({
    page,
  }) => {
    await page.goto("/admin/login?redirect=https://evil.com/path");

    // Login as admin
    await page.fill('input[name="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 5000 });
    expect(page.url()).toContain("/admin/dashboard");
    expect(page.url()).not.toContain("evil.com");
  });

  test("?redirect=//evil.com is sanitized", async ({ page }) => {
    await page.goto("/admin/login?redirect=//evil.com");

    await page.fill('input[name="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 5000 });
    expect(page.url()).not.toContain("evil.com");
  });

  test("?redirect=/admin/termini is honored (legitimate use case)", async ({
    page,
  }) => {
    await page.goto("/admin/login?redirect=/admin/termini");

    await page.fill('input[name="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/admin\/termini/, { timeout: 5000 });
    expect(page.url()).toContain("/admin/termini");
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm run test:e2e:local -- open-redirect`
Expected: PASS — Task 3 je već primijenio fix.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/open-redirect.spec.ts
git commit -m "test(security): E2E coverage za open-redirect zaštitu na login-u"
```

---

## Task 10: Dokumentuj proxy ograničenje

**Files:**
- Modify: `src/proxy.ts:62-64`
- Modify: `CLAUDE.md` (auth section)

- [ ] **Step 1: Update komentar u proxy.ts**

Replace lines 62-64:

```ts
/**
 * Matcher: SAMO `/admin/:path*`. API rute (`/api/*`) NISU pokrivene proxy-jem.
 * Ako dodaješ novu API rutu koja zahtijeva auth, uradi jednu od:
 *   1) Dodaj `requireAdmin()` poziv unutar route handler-a (vidi `src/app/api/availability/route.ts`).
 *   2) Proširi matcher i dodaj odgovarajući guard ovdje.
 * Public rute (`/`, `/zakazi`, `/galerija`, ...) namjerno nisu pokrivene
 * — proxy se ne troši na rute gdje nema sesije za refresh.
 */
export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Add a one-line note to CLAUDE.md auth section**

Modify `CLAUDE.md` — dodati nakon postojeće "Next.js 16 — `proxy.ts` replaces middleware" sekcije, na kraj paragrafa:

Pronađi:
```
`src/proxy.ts` is the auth guard and session refresh layer. It runs on `/admin/:path*` routes only. There is no `middleware.ts`. Check `node_modules/next/dist/docs/` before using any Next.js API — this version has breaking changes from training data.
```

Zamijeni sa:
```
`src/proxy.ts` is the auth guard and session refresh layer. It runs on `/admin/:path*` routes only. There is no `middleware.ts`. Check `node_modules/next/dist/docs/` before using any Next.js API — this version has breaking changes from training data.

**API routes are NOT covered by the proxy.** New `/api/*` routes that need auth must call `requireAdmin()` (or check the session manually) inside the handler. The protected admin layout (`src/app/admin/(protected)/layout.tsx`) double-checks admin email as defense-in-depth.
```

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts CLAUDE.md
git commit -m "docs(security): dokumentuj proxy matcher ograničenje (API rute nisu pokrivene)"
```

---

## Self-Review Notes

**Spec coverage matrix (audit nalaz → task):**
- H1 (PII u logovima) → Task 2
- H2 (`time_blocks.reason`) → Task 5
- H3 (proxy ne pokriva `/api/*`) → Task 10 (dokumentacija; route-i već imaju svoj guard)
- M1 (in-memory rate limit) → Task 7
- M2 (layout require-admin) → Task 4
- M3 (`ADMIN_EMAILS` na 3 mjesta) → Task 1
- M4 (open redirect) → Task 3 + Task 9
- L1 (CSP) → Task 8
- L2 (storage policies) → Task 6
- L3 (`npm audit` moderate) → Skipped (tranzitivno kroz Next, prati Next 16 patch release)
- C1 (rotacija ključeva) → Out of scope (ostavljeno za handover, vidi memory)

**Dependency order:**
- Task 1 mora prije Task 4 (layout koristi `isAdminEmail`)
- Task 5 mora prije generisanja TS tipova; ostali task-i nezavisni
- Task 7 utiče na Task 9 callsite-e ali su nezavisni testovi

**Suggested execution sequence (linearno radi clean diff-ova):**
1. Task 1 — centralization (foundation za 4)
2. Task 2 — log sanitize (independent)
3. Task 3 — safe redirect helper
4. Task 4 — layout guard (depends on 1)
5. Task 5 — time_blocks view (DB)
6. Task 6 — storage policies (DB)
7. Task 7 — Upstash rate limit
8. Task 8 — CSP header
9. Task 9 — open-redirect E2E (validira 3)
10. Task 10 — proxy comment + CLAUDE.md
