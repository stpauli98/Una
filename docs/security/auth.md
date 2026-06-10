# Autentikacija — Login, JWT, whitelist

Kompletan auth flow od login forme do admin pristupa.

## Komponente sistema

| Komponenta | Fajl | Svrha |
|-----------|------|-------|
| `LoginForm` | `src/components/admin/LoginForm.tsx` | UI za login |
| Supabase Auth | (external) | Identity provider |
| `createClient` (browser) | `src/lib/supabase/client.ts` | Sign-in poziv |
| `createClient` (server) | `src/lib/supabase/server.ts` | Citanje sesije iz cookies |
| `proxy.ts` | `src/proxy.ts` | Auth guard middleware |
| `requireAdmin` | `src/lib/supabase/require-admin.ts` | Server action guard |
| `ADMIN_EMAILS` | `src/lib/auth/admin-emails.ts` | Application-level whitelist |
| `is_admin()` | DB function | DB-level whitelist (RLS) |

## Login flow — korak po korak

### 1. UI

Una posjeti `/admin` → `proxy.ts` detektuje da nije logovana → redirect `/admin/login`.

### 2. Forma submit

```typescript
// LoginForm.tsx
const sb = createClient();
const { data, error } = await sb.auth.signInWithPassword({
  email,
  password,
});
```

### 3. Supabase verifikuje

Supabase server:
- Hash email + password
- Compare sa store-d hash-om
- Ako match → generiše JWT pair (`access_token` 1h, `refresh_token` ∞)
- Send-uje JWT klijentu

### 4. Cookies se set-uju

Supabase JS klijent automatski set-uje cookies:

```
sb-<project>-auth-token       (access token, httpOnly, secure)
sb-<project>-auth-token.0     (split sa refresh tokenom)
sb-<project>-auth-token.1
```

### 5. Redirect na dashboard

```typescript
router.push(redirect ?? "/admin/dashboard");
```

### 6. Proxy provjerava

```typescript
// src/proxy.ts
const sb = createServerClient(URL, ANON_KEY, { cookies });
const { data: { user } } = await sb.auth.getUser();

if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
  if (!user || !ADMIN_EMAILS.has(user.email ?? "")) {
    return NextResponse.redirect("/admin/login");
  }
}
```

Provjerava:
1. Da li postoji `user` (validan JWT)
2. Da li je `user.email` u `ADMIN_EMAILS` whitelist-i

Ako jedno fail → redirect na login.

### 7. Admin shell renders

`AdminShell` sa sidebar / bottom nav-om.

## `getUser()` vs `getSession()`

Bitno za sigurnost.

| Method | Šta radi |
|--------|----------|
| `getUser()` | Server-side JWT verifikacija (HMAC check) |
| `getSession()` | Samo citra cookies, ne verifikuje |

**Mi koristimo `getUser()`** u proxy-ju jer:
- Sigurniji (`getSession` može vratiti expired/forged JWT)
- Provjerava JWT signature
- Marginalno sporiji (~2-5ms extra)

Bez `getUser`, attacker bi mogao podmetnuti cookie sa proizvoljnim payload-om i proxy bi mu vjerovao.

## ADMIN_EMAILS whitelist

```typescript
// src/lib/auth/admin-emails.ts
const BASE_ADMINS = ["peranovicuna6@gmail.com"];

const EXTRA = process.env.ADMIN_EMAILS_EXTRA?.split(",").map(s => s.trim()) ?? [];

export const ADMIN_EMAILS = new Set([...BASE_ADMINS, ...EXTRA]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email);
}
```

### Why `Set`?

`Set.has()` je O(1). Lista sa `includes()` je O(n). Za 1-5 emails nema razlike, ali konvencija je da je `Set` brži.

### ADMIN_EMAILS_EXTRA env var

Za E2E test (`test@admin.com`). Nije u produkciji.

## Server actions guard

Sve admin server actions koriste `requireAdmin()`:

```typescript
// src/lib/supabase/require-admin.ts
"use server";

import { createClient } from "./server";
import { isAdminEmail } from "@/lib/auth/admin-emails";

export async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) throw new Error("Nije autorizovan");
  if (!isAdminEmail(user.email)) throw new Error("Nemate admin pristup");

  return sb;
}
```

### Use u actions

```typescript
// src/app/admin/(protected)/termini/actions.ts
export async function confirmAppointment(id: number) {
  try {
    const sb = await requireAdmin();
    const { error } = await sb.from("appointments").update({...}).eq("id", id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

`requireAdmin()` baca grešku → `try/catch` vraća user-friendly error.

## Defense in depth — 3 sloja auth

```
┌─────────────────────────────────────────┐
│  1. proxy.ts — request URL level        │  ← page navigation
│     Redirect ako nije admin              │
├─────────────────────────────────────────┤
│  2. requireAdmin() — action level       │  ← server action POST
│     Throw error ako nije admin           │
├─────────────────────────────────────────┤
│  3. RLS is_admin() — DB level           │  ← row access
│     RLS politika denies                  │
└─────────────────────────────────────────┘
```

Svaki sloj nezavisan. Ako attacker zaobiđe proxy (npr. direct API call), `requireAdmin` ga zaustavi. Ako zaobiđe oba, RLS politika.

## Sesija — istek i refresh

JWT `access_token` traje **1h** (`jwt_expiry = 3600` u Supabase config).

Refresh token nema isteka (`enable_refresh_token_rotation = true`).

Kad access istekne:
1. Proxy detektuje (kroz `getUser`)
2. Supabase JS klijent auto-refresh-uje koristeci refresh token
3. Novi access token se postavi u cookies
4. Request prolazi

Una ne primjeti — sve transparent.

## Logout

```typescript
const sb = createClient();
await sb.auth.signOut();
// Cookies se brišu
router.push("/admin/login");
```

`AdminShell` ima "Sign out" dugme u sidebar-u (desktop) ili bottom (mobile).

## Open redirect zaštita

```typescript
// src/lib/utils/safe-redirect.ts
export function safeRedirect(url: string | null): string {
  if (!url) return "/admin/dashboard";
  if (!url.startsWith("/")) return "/admin/dashboard";  // Spriječi `https://evil.com`
  if (url.startsWith("//")) return "/admin/dashboard";  // Spriječi `//evil.com`
  return url;
}
```

Test: `tests/unit/safe-redirect.test.ts`

Use case: napadač pošalje phishing link `/admin/login?redirect=https://evil.com`. Bez `safeRedirect`, nakon login Una bi bila redirect-ovana na evil. Sa `safeRedirect`, redirect ide na dashboard.

## Password politika

Supabase config:

```toml
[auth]
minimum_password_length = 8
password_requirements = "lower_upper_letters_digits"
```

`changePassword` action dodatno enforce-uje:

```typescript
if (newPassword.length < 8) return { ok: false, error: "..." };
if (!/[A-Z]/.test(newPassword)) return { ok: false, error: "Veliko slovo..." };
if (!/[a-z]/.test(newPassword)) return { ok: false, error: "Malo slovo..." };
if (!/\d/.test(newPassword)) return { ok: false, error: "Cifra..." };
```

## Signup disabled

```toml
[auth]
enable_signup = false
enable_confirmations = false
```

Niko ne može kreirati nalog kroz `/auth/v1/signup` Supabase endpoint.

Una je dodana ručno preko Supabase Dashboard. Detalji: [signup-disabled.md](./signup-disabled.md)

## MFA

Trenutno disabled (`mfa.enabled = false` u config). Mogli bismo uključiti TOTP za extra security.

Trade-off: Una bi morala authenticator app na telefonu. Trenutno: password je dovoljan.

## Brute force protection

Supabase ima rate limit na auth endpoint-ima:

```toml
[auth.rate_limit]
sign_in_sign_ups = 30  # per 5 min per IP
```

Granular limit (npr. specifično za login). Ali to je sufficient za skala UP Makeup-a.
