# `is_admin()` — Postgres funkcija

Centralna funkcija koja provjerava da li je trenutni JWT email u admin whitelist-i.

## Definicija

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com' $$;
```

## Razlaganje

| Klauzula | Razlog |
|----------|--------|
| `STABLE` | Ne mijenja DB state, deterministic unutar transakcije (Postgres može cache-ovati) |
| `SECURITY DEFINER` | Pokreće se sa privilegijama vlasnika funkcije (`postgres`), ne pozivaoca |
| `SET search_path = ''` | Sprjecava SQL injection kroz `search_path` |
| `auth.jwt() ->> 'email'` | Supabase ekstenzija — vrati JSONB JWT, ekstraktuj `email` |

## Use u RLS

```sql
CREATE POLICY "appointments: admin full"
  ON appointments FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

Politika prolazi samo ako trenutni JWT pripada `peranovicuna6@gmail.com`.

## Multi-admin support (TBD)

Trenutno je email hardkodiran u funkciji. Za više admina, mogli bismo:

### Opcija A — Lista u funkciji

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
AS $$ SELECT auth.jwt() ->> 'email' IN ('peranovicuna6@gmail.com', 'helper@studio.com') $$;
```

Mijenja se kroz migraciju.

### Opcija B — `admin_users` tabela

```sql
CREATE TABLE admin_users (
  email TEXT PRIMARY KEY,
  active BOOLEAN DEFAULT true
);

CREATE FUNCTION is_admin()
RETURNS boolean
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE email = auth.jwt() ->> 'email' AND active = true
  )
$$;
```

Mijenja se kroz INSERT/UPDATE u `admin_users` tabeli.

### Opcija C — JWT custom claim

```sql
SELECT (auth.jwt() ->> 'role') = 'admin'
```

Trebao bi custom claim u JWT-u — Supabase ima `app_metadata` polje.

**Trenutno:** Hardkodirano (Opcija A sa jedan email). Una je jedini admin.

## Sync sa application-level whitelist

Application kod ima paralelnu whitelist:

```typescript
// src/lib/auth/admin-emails.ts
export const ADMIN_EMAILS = new Set([
  "peranovicuna6@gmail.com",
  ...(process.env.ADMIN_EMAILS_EXTRA?.split(",") ?? []),
]);
```

**Problem:** Dva mjesta za održavanje (DB funkcija + ENV var). Ako se ne sync-uju, ponašanje se razlikuje:
- DB pristup: kroz `is_admin()` (samo Una)
- Application pristup: kroz `ADMIN_EMAILS.has(email)` (Una + ENV extras)

**Trenutno koristi:** Za production sve ide kroz Una email (sync). `ADMIN_EMAILS_EXTRA` je za E2E test (`test@admin.com`).

E2E test environment ne pogoda produkciju RLS (lokalni Docker Supabase ima drugačiji `is_admin()` ili je RLS disabled).

## Testiranje

### SQL test

```sql
-- Login kao Una
SELECT is_admin();
-- → true

-- Login kao drugi user
SET role authenticated;
-- (treba simulirati JWT email = 'other@example.com')
SELECT is_admin();
-- → false
```

### Application test

```typescript
// tests/unit/admin-emails.test.ts
test("isAdminEmail returns true for known admin", () => {
  expect(isAdminEmail("peranovicuna6@gmail.com")).toBe(true);
});

test("isAdminEmail returns false for unknown", () => {
  expect(isAdminEmail("random@example.com")).toBe(false);
});
```

## SECURITY DEFINER zašto

`SECURITY DEFINER` znači funkcija radi sa privilegijama svog **vlasnika** (postgres role), ne svog **pozivaoca**.

Razlog: `auth.jwt()` je u `auth` schemi koju anon ne smije pristupiti direktno. Sa `SECURITY DEFINER`, funkcija može pristupiti `auth.jwt()` čak i kad pozivaoca je anon role.

Bez `SECURITY DEFINER`, anon bi dobio "permission denied for schema auth".

## search_path = '' zašto

Postgres koristi `search_path` da resolvuje unqualified imena (`foo` → `public.foo` ili `auth.foo`...).

Ako bi attacker postavio `search_path` da pokazuje na njegovu shemu, mogao bi presretati function calls:

```sql
SET search_path = malicious, public;
-- Sad "foo()" prvo gleda u "malicious.foo()"
```

`SET search_path = ''` u funkciji forsira eksplicitan schema prefix (kao `auth.jwt()`). Sve nazive resolvujemo eksplicitno → siguran.

## STABLE optimization

Postgres može cache-ovati rezultat unutar jedne transakcije:

```sql
SELECT id FROM appointments WHERE is_admin() AND ...;
-- is_admin() se računa jednom, ne za svaki red
```

Bez `STABLE`, Postgres bi pretpostavio da se rezultat mijenja po redu — pa bi računao za svaki.

## Migracija

`supabase/migrations/20260527000000_security_hardening.sql` linija 12-16:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com' $$;
```

`CREATE OR REPLACE` — idempotent (može se pokrenuti više puta).

## Sledeće

- [rls-policies.md](./rls-policies.md) — gdje se `is_admin()` koristi
- [auth.md](./auth.md) — kako se JWT generiše (Supabase Auth)
