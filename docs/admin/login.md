# Admin: `/admin/login` — Login

**Fajl:** `src/app/admin/login/page.tsx`, `src/components/admin/LoginForm.tsx`

Jedina admin ruta koja **NIJE** auth-guard-ovana (logičan razlog — ovdje se Una loguje).

## UI

Centriran login forme na marble pozadini:

- Brand logo (UP / Makeup / Admin Panel)
- Email input (`autocomplete="email"`)
- Password input (`autocomplete="current-password"`)
- "Prijavi se" dugme
- Error poruka ispod (ako login fail)

## Auth flow

```typescript
// LoginForm.tsx
async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  const sb = createClient();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    setError("Neispravan email ili lozinka");
    return;
  }
  router.push(redirect ?? "/admin/dashboard");
}
```

Supabase Auth:
1. Provjeri credentials
2. Vrati JWT (`access_token` + `refresh_token`)
3. Cookies se automatski set-uju (`sb-<project>-auth-token`)

## Email whitelist check

Login uspjeh ne znači admin pristup. **Proxy** (`src/proxy.ts`) na svakom request-u na `/admin/*` provjerava:

```typescript
if (!user || !ADMIN_EMAILS.has(user.email ?? "")) {
  return NextResponse.redirect("/admin/login");
}
```

`ADMIN_EMAILS`: `src/lib/auth/admin-emails.ts`

```typescript
export const ADMIN_EMAILS = new Set([
  "peranovicuna6@gmail.com",      // Una
  // process.env.ADMIN_EMAILS_EXTRA — comma-separated dodatni
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email);
}
```

Test admin (`test@admin.com`) je u env varu `ADMIN_EMAILS_EXTRA` za E2E.

## Redirect logic

| Situacija | Redirect |
|-----------|----------|
| Neautentifikovan na `/admin/*` | `/admin/login?redirect={pathname}` |
| Već logovan, ide na `/admin/login` | `/admin/dashboard` |
| Login uspješan, postoji `redirect` param | Taj URL |
| Login uspješan, bez param-a | `/admin/dashboard` |

## Open redirect zaštita

`redirect` query param prolazi kroz `safeRedirect()` validaciju da spriječi otvoren redirect attack:

```typescript
// src/lib/utils/safe-redirect.ts
export function safeRedirect(url: string | null): string {
  if (!url) return "/admin/dashboard";
  // Samo same-origin pathove dozvoljavamo
  if (!url.startsWith("/")) return "/admin/dashboard";
  if (url.startsWith("//")) return "/admin/dashboard";
  return url;
}
```

Test: `tests/unit/safe-redirect.test.ts`

## Greške

| Backend error | UI prikaz |
|---------------|-----------|
| Invalid credentials | "Neispravan email ili lozinka" |
| Non-admin email | Redirect bez user obavijesti (silent fail) |
| Network error | "Došlo je do greške, pokušajte ponovo" |

**Razlog za genericku poruku:** Ne otkrivamo da li je email validan (sprjecavamo enumeration).

## Lozinka

| Pravilo | Vrijednost |
|---------|-----------|
| Min dužina | 8 char (`changePassword` action enforce) |
| Mora imati | Veliko, malo, broj |
| Supabase min | 8 char (config.toml) |
| Complexity | `lower_upper_letters_digits` |

Una može mijenjati lozinku kroz `/admin/postavke` → `ChangePasswordForm`.

## Signup

**Isključen** na Supabase Dashboard nivou (`enable_signup = false`).

Niko ne može kreirati nalog kroz UI. Una je jedini admin.

Detalji: [../security/signup-disabled.md](../security/signup-disabled.md)
