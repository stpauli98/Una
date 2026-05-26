# Security Hardening Design — UP Beauty

**Datum:** 2026-05-26
**Baziran na:** `claudedocs/SECURITY-AUDIT-2026-05-26.md`
**Scope:** Svih 26 propusta (4 KRITIČNA, 8 VISOKA, 7 SREDNJA, 7 NISKIH)
**Pristup:** Jedna DB migracija + aplikacijski code sweep
**Status aplikacije:** U razvoju (ne live), slobodno mijenjamo migracije

---

## Pregled arhitekture popravki

```
Faza 1: DB/RLS hardening        → jedna migracija 20260527000000_security_hardening.sql
Faza 2: Rate limiting & IP      → rate-limit.ts, login action, availability routes
Faza 3: Booking validation      → validate-slot.ts, availability routes, zakazi/actions.ts
Faza 4: HTTP security headers   → next.config.ts
Faza 5: Utility & cleanup fixes → csv.ts, galerija/actions.ts, email-actions.ts, .env.example, itd.
Faza 6: Secret rotation         → manualna operativna akcija (Supabase/Resend/Vercel dashboards)
```

---

## Faza 1: Database / RLS Hardening

**Migracija:** `supabase/migrations/20260527000000_security_hardening.sql`

Rješava: K1, K2, K3, S4, S5

### 1.1 `is_admin()` SQL funkcija

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com' $$;
```

- `SECURITY DEFINER` — pristup internim `auth.jwt()` funkcijama
- `STABLE` — ne mijenja se unutar iste transakcije, dozvoljena u RLS
- `SET search_path = ''` — sigurnosna best practice za SECURITY DEFINER funkcije
- Hardkodiran email — single-admin app, nema potrebe za tabelom

### 1.2 Čišćenje starih RLS politika (K1)

Drop svih starih politika po ISPRAVNIM imenima:

```sql
-- appointments (K1 fix — original "public insert" NIKAD nije bio dropovan)
DROP POLICY IF EXISTS "appointments: public insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments: anon insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments: authenticated full access" ON public.appointments;

-- training_inquiries
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
```

Također:
```sql
-- time_blocks
DROP POLICY IF EXISTS "time_blocks: public read" ON public.time_blocks;
DROP POLICY IF EXISTS "time_blocks: authenticated full access" ON public.time_blocks;

-- settings
DROP POLICY IF EXISTS "settings: public read" ON public.settings;
DROP POLICY IF EXISTS "settings: authenticated full access" ON public.settings;

-- push_subscriptions
DROP POLICY IF EXISTS "push_subscriptions: user can read own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: user can insert own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: user can delete own" ON public.push_subscriptions;

-- storage: gallery bucket
DROP POLICY IF EXISTS "gallery: public read" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated delete" ON storage.objects;

-- storage: services bucket
DROP POLICY IF EXISTS "services: public read" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated delete" ON storage.objects;
```

### 1.3 Nove RLS politike (K2)

Za svaku tabelu, jasna separacija:

**services:**
- `SELECT` za `anon` — samo `active = true` (javni cjenovnik)
- `ALL` za `authenticated` — samo ako `is_admin()` (admin CRUD)

**gallery_images:**
- `SELECT` za `anon, authenticated` — javna galerija
- `INSERT/UPDATE/DELETE` za `authenticated` — samo `is_admin()`

**blocked_dates, working_hours:**
- `SELECT` za `anon, authenticated` — potrebno za availability engine
- `INSERT/UPDATE/DELETE` za `authenticated` — samo `is_admin()`

**appointments:**
- `INSERT` za `anon` — `WITH CHECK (status = 'ceka' AND confirmation_sent_at IS NULL)`
- `SELECT/UPDATE/DELETE` za `authenticated` — samo `is_admin()`
- `INSERT` za `authenticated` — samo `is_admin()` (admin manual booking)

**training_inquiries:**
- `INSERT` za `anon` — `WITH CHECK (status = 'novi')`
- `ALL` za `authenticated` — samo `is_admin()`

**settings:**
- `SELECT` za `anon` — potrebno za booking settings (min_hours_before itd.)
- `INSERT/UPDATE/DELETE` za `authenticated` — samo `is_admin()`

**time_blocks:**
- Nema anon pristup (koristi se `time_blocks_public` view za anon)
- `ALL` za `authenticated` — samo `is_admin()`

**push_subscriptions:**
- `ALL` za `authenticated` — samo `is_admin()`

### 1.4 Storage politike (K3)

**gallery bucket:**
- `SELECT` ostaje public (`anon, authenticated`)
- `INSERT/UPDATE/DELETE` — `authenticated` samo ako `is_admin()`

**services bucket:**
- Isti pattern kao gallery

### 1.5 Realtime PII (S4, S5) — automatski riješeno

Kad K2 ograniči `SELECT` na appointments i time_blocks na `is_admin()`, realtime subscription automatski prestaje leakovati PII neadmin korisnicima. Nema dodatnog koda.

---

## Faza 2: Rate Limiting & IP Handling

Rješava: V2, V3, V7

### 2.1 `getClientIp()` helper (V2)

**Fajl:** `src/lib/utils/rate-limit.ts`

Nova exportovana funkcija:
```typescript
export function getClientIp(hdrs: Headers): string {
  return (
    hdrs.get("x-real-ip") ??
    hdrs.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown"
  );
}
```

- Primarno `x-real-ip` (Vercel ga postavlja, klijent ne može spoofovati)
- Fallback na zadnji IP u `x-forwarded-for` (pravi klijent IP u proxy lancu)
- Zamijeniti ručno čitanje IP-a u:
  - `src/app/api/availability/route.ts:25`
  - `src/app/api/availability/month/route.ts:26`
  - `src/app/zakazi/actions.ts:31`

### 2.2 `failClosed` opcija (V3)

**Fajl:** `src/lib/utils/rate-limit.ts`

Proširiti `checkRateLimit()` potpis:
```typescript
export async function checkRateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000,
  opts?: { failClosed?: boolean },
): Promise<boolean>
```

U catch bloku:
```typescript
catch {
  if (opts?.failClosed) return false;
  return memCheck(ip, limit, windowMs);
}
```

Koristiti `failClosed: true` za:
- `createAppointment()` — booking je kritičan path
- Login server action (V7) — brute force zaštita

### 2.3 Login Rate Limiting (V7)

**Novi fajl:** `src/app/admin/login/actions.ts`

```typescript
"use server";

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!(await checkRateLimit(ip, 5, 300_000, { failClosed: true }))) {
    return { ok: false, error: "Previše pokušaja. Pokušajte za 5 minuta." };
  }

  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) return { ok: false, error: "Pogrešan email ili lozinka" };
  return { ok: true };
}
```

**Izmjena:** `src/components/admin/LoginForm.tsx`
- Zamijeniti direktni `sb.auth.signInWithPassword()` poziv sa `loginAction(formData)`
- Dodati error handling za rate limit response

---

## Faza 3: Booking Validation & Business Logic

Rješava: V1, V8, S1

### 3.1 isAdmin Check Fix (V1)

**Fajlovi:**
- `src/app/api/availability/route.ts:43`
- `src/app/api/availability/month/route.ts:46`

Promjena:
```typescript
// Dodati import:
import { isAdminEmail } from "@/lib/auth/admin-emails";

// Zamijeniti liniju:
isAdmin = !!user && isAdminEmail(user.email);
```

### 3.2 Server-side Slot Validation (V8)

**Novi fajl:** `src/lib/booking/validate-slot.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

interface SlotValidationResult {
  valid: boolean;
  reason?: string;
}

export async function validateSlotServerSide(
  sb: SupabaseClient,
  start: Date,
  end: Date,
): Promise<SlotValidationResult>
```

Logika:
1. **Working hours:** Učitaj `working_hours` za `start.getDay()`. Provjeri da li slot pada unutar `open_time`/`close_time`. Ako dan nije `is_open`, vrati invalid.
2. **Blocked dates:** Učitaj `blocked_dates` iz baze. Provjeri da li `start` datum pada u bilo koji `date_from`/`date_to` raspon.
3. **Time blocks:** Učitaj `time_blocks` koji overlapuju `[start, end)`. Ako postoji overlap, vrati invalid.

Sva tri querija idu paralelno (`Promise.all`).

**Izmjena u `zakazi/actions.ts`:**
Pozvati `validateSlotServerSide(sb, start, end)` nakon min_hours_before provjere, prije race guard check-a.

### 3.3 Booking Client Separation (S1)

**Fajl:** `src/app/zakazi/actions.ts`

Trenutno koristi `createAdminClient()` za SVE (SELECT + INSERT).

Promjena:
- `createAdminClient()` za SELECT operacije (race guard, settings, service lookup, slot validation) — jer anon nema SELECT na appointments
- Novi `createPublicClient()` (bez cookies, anon ključ) za INSERT — tako da RLS constraint `status = 'ceka'` vrijedi kao defense-in-depth

**Postojeći fajl:** `src/lib/supabase/public.ts` — već sadrži `createPublicClient()` (anon ključ, bez cookie-a). Koristi ovaj za INSERT u booking flow-u.

---

## Faza 4: HTTP Security Headers

Rješava: V4, V5

**Fajl:** `next.config.ts`

### 4.1 CSP Enforced (V4)

Zamijeniti `Content-Security-Policy-Report-Only` sa `Content-Security-Policy`.

`'unsafe-inline'` ostaje za `script-src` jer Next.js runtime ga zahtijeva bez nonce setup-a. Ukloniti `'unsafe-eval'` iz produkcije (već je conditional na dev).

### 4.2 HSTS (V5)

Dodati u headers array:
```typescript
{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
```

---

## Faza 5: Utility & Cleanup Fixes

### 5.1 CSV Formula Injection (V6)

**Fajl:** `src/lib/utils/csv.ts`

U `csvEscape()`, dodati na početku (prije existing checks):
```typescript
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
if (FORMULA_PREFIX.test(s)) {
  return `"'${s.replace(/"/g, '""')}"`;
}
```

### 5.2 Body Size Limit (S3)

**Fajl:** `next.config.ts:67`

Smanjiti `bodySizeLimit` sa `"10mb"` na `"6mb"`.

### 5.3 Dev Script Binding (S6)

**Fajl:** `package.json`

Ukloniti `-H 0.0.0.0` iz `dev` skripte:
```json
"dev": "next dev"
```
`start` ostaje sa `-H 0.0.0.0` (potrebno za Docker/produkciju).

### 5.4 Error Message Sanitization (N1)

**Fajlovi:**
- `src/app/api/availability/route.ts`
- `src/app/api/availability/month/route.ts`

Zamijeniti sve `error.message` response-e:
```typescript
console.error("query failed:", sanitizeError(error));
return NextResponse.json({ error: "Greška pri učitavanju podataka" }, { status: 500 });
```

Dodati `import { sanitizeError } from "@/lib/utils/log"` u oba fajla.

### 5.5 ICS UID Fix (N3)

**Fajl:** `src/lib/notifications/send-admin-email.ts`

```typescript
// Staro:
uid: `appt-${input.startTime.getTime()}@upmakeup.ba`
// Novo:
uid: `appt-${input.appointmentId}@upmakeup.ba`
```

### 5.6 .env.example Email (N5)

**Fajl:** `.env.example:9`

```
ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

### 5.7 Crypto Random Filenames (N6)

**Fajl:** `src/app/admin/(protected)/galerija/actions.ts`

```typescript
// Staro:
const random = Math.random().toString(36).slice(2, 8);
// Novo:
const random = crypto.randomUUID().slice(0, 8);
```

### 5.8 requireAdmin() na Email Config (N7)

**Fajl:** `src/app/admin/(protected)/postavke/email-actions.ts`

Dodati `await requireAdmin()` na početak `getEmailNotificationConfig()`.

### 5.9 Env Var Trimming (S7)

**Fajlovi:**
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/public.ts`

Svuda gdje se čita `process.env.NEXT_PUBLIC_SUPABASE_URL!` ili `SUPABASE_SERVICE_ROLE_KEY`, dodati `.trim()`:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
```

---

## Faza 6: Secret Rotation (K4)

Manualna operativna akcija — NE code change:

1. **Supabase Dashboard:** Settings → API → Regenerate service_role key
2. **Resend Dashboard:** API Keys → Revoke `re_NjErGhYA_...` → Create new key
3. **Vercel Dashboard:** Settings → Environment Variables → Ažurirati:
   - `SUPABASE_SERVICE_ROLE_KEY` (novi, BEZ trailing `\n`)
   - `RESEND_API_KEY` (novi)
   - Provjeriti/fixati trailing `\n` na SVIM env vars
4. **Lokalno:** Obrisati `.vercel/.env.production.local`
5. **Redeploy:** Vercel automatski redeploy-uje kad se env vars promijene

---

## Accepted Risks (ne popravljamo u ovoj fazi)

**N2 — Confirmation Token u URL-u:**
UUID je kriptografski random (128 bit), nemoguće pogoditi. Leakage kroz referrer je minimalan rizik jer success page ne linkuje na eksterne sajtove. Accepted.

**N4 — Admin Panel URL u emailovima:**
Admin panel je auth-protected. Znanje URL pattern-a ne daje pristup. Accepted.

**S2 — CAPTCHA:**
Odgođeno per user decision. Rate limiting + IP fix (V2) značajno smanjuje rizik od booking spam-a u međuvremenu.

---

## Testiranje

Svaka faza treba:

1. **Faza 1:** `supabase db reset` na lokalnom Docker-u → potvrditi da nove RLS politike blokiraju anon/authenticated pristup gdje treba. Ručno testirati sa curl-om da anon INSERT appointment sa `status != 'ceka'` bude odbijen.
2. **Faza 2:** Unit testovi za `getClientIp()`, `checkRateLimit({ failClosed: true })`. E2E test za login rate limiting.
3. **Faza 3:** Unit testovi za `validateSlotServerSide()`. E2E test: pokušaj bookinga van radnog vremena treba da fail-uje.
4. **Faza 4:** `curl -I https://localhost:3000` — provjeri da CSP i HSTS headeri postoje.
5. **Faza 5:** Unit test za `csvEscape("=cmd|...")` — treba da prefixuje sa `'`. Postojeći 151 unit test mora proći.
6. **Faza 6:** Manuelna provjera da produkcija radi sa novim ključevima.

---

## Fajlovi koji se mijenjaju

| Fajl | Faza | Promjena |
|------|------|----------|
| `supabase/migrations/20260527000000_security_hardening.sql` | 1 | NOVI — RLS hardening |
| `src/lib/utils/rate-limit.ts` | 2 | `getClientIp()`, `failClosed` opcija |
| `src/app/admin/login/actions.ts` | 2 | NOVI — login server action |
| `src/components/admin/LoginForm.tsx` | 2 | Prebaciti na server action |
| `src/app/api/availability/route.ts` | 2,3,5 | IP fix, isAdmin fix, error sanitization |
| `src/app/api/availability/month/route.ts` | 2,3,5 | IP fix, isAdmin fix, error sanitization |
| `src/app/zakazi/actions.ts` | 2,3 | IP fix, slot validation, client separation |
| `src/lib/booking/validate-slot.ts` | 3 | NOVI — server-side slot validation |
| `src/lib/supabase/public.ts` | 3,5 | Dodati .trim(), koristiti za booking INSERT |
| `next.config.ts` | 4,5 | CSP enforced, HSTS, body size |
| `src/lib/utils/csv.ts` | 5 | Formula injection zaštita |
| `package.json` | 5 | Ukloniti `-H 0.0.0.0` iz dev |
| `src/lib/notifications/send-admin-email.ts` | 5 | ICS UID fix |
| `.env.example` | 5 | Placeholder email |
| `src/app/admin/(protected)/galerija/actions.ts` | 5 | crypto.randomUUID |
| `src/app/admin/(protected)/postavke/email-actions.ts` | 5 | requireAdmin() |
| `src/lib/supabase/admin.ts` | 5 | .trim() env vars |
| `src/lib/supabase/server.ts` | 5 | .trim() env vars |
| `src/lib/supabase/client.ts` | 5 | .trim() env vars |
