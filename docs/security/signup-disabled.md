# Signup disabled

Niko ne može kreirati Supabase nalog kroz `/auth/v1/signup` endpoint.

## Konfiguracija

### `supabase/config.toml`

```toml
[auth]
enable_signup = false
enable_anonymous_sign_ins = false
enable_confirmations = false
```

### Production Supabase Dashboard

Authentication → Settings → "Enable sign ups" → **OFF**.

(Dashboard setting overrides config.toml za produkciju.)

## Šta ovo sprjecava

### 1. Public registration

Bez signup-a, niko ne može:
- POST `https://<project>.supabase.co/auth/v1/signup`
- Kreirati nalog kroz npr. SDK `signUp()` method

### 2. Privilege escalation

Bez signup-a, attacker ne može:
- Kreirati `attacker@evil.com` nalog
- Dobiti `authenticated` JWT
- Pristupiti `authenticated`-level RLS politikama

(Defense in depth: čak da signup je enabled, `is_admin()` check bi blokirao non-Una emails. Ali bolje 2 sloja.)

### 3. Email spam

`enable_confirmations = false` znači da Supabase ne salje confirmation emails. Bez signup-a, ovo nije problem.

## Una nalog — kako je kreiran

Una je dodata **direktno kroz Supabase Dashboard**:
1. Login Dashboard
2. Authentication → Users → "Add user"
3. Email + password
4. Email auto-confirmed

Ne kroz UI signup.

## Šta ako Una izgubi pristup

| Scenarij | Recovery |
|----------|----------|
| Zaboravi password | Supabase Auth → Forgot password (radi za postojeće naloge) |
| Email kompromitovan | Dashboard → promijeniti email |
| 2FA telefon izgubljen | N/A (MFA disabled) |
| Nalog potpuno izgubljen | Project owner može kreirati novi user kroz Dashboard |

## Dodavanje novog admina (TBD)

Ako se ikad doda više admina:

1. **Dashboard** → kreirati user
2. **Code** → dodati email u `ADMIN_EMAILS` set u `src/lib/auth/admin-emails.ts`
3. **Migration** → update `is_admin()` funkciju u Postgres-u

Trenutno: samo Una. Stack-overflow approach nije potreban.

## Alternative — invite-only signup

Mogli bismo imati invite token sistem:

1. Postojeći admin generiše invite token
2. Šalje URL sa tokenom
3. Pozivani klikne → form sa email + password
4. Submit kreira nalog ako token validan

Trade-off: kompleksnije, dodatna tabela `invite_tokens`, dodatne RLS politike.

**Trenutno:** Single admin → Direct Dashboard kreiranje dovoljno.

## CAPTCHA

Trenutno **nije konfigurisan**. Supabase config:

```toml
[auth.captcha]
# enabled = false (default)
```

Razlozi za neimplementaciju:
- Signup je vec disabled — niko ne može pokrenuti registration flow
- Brute force login je adresiran kroz Supabase `sign_in_sign_ups = 30` rate limit
- CAPTCHA dodaje friction za Unu pri login-u

Ako se ikad uključi signup, treba i CAPTCHA.

## Verify

### Test endpoint

```bash
curl -X POST https://<project>.supabase.co/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"Test1234!"}'
```

Expected response:

```json
{
  "code": 422,
  "msg": "Signups not allowed for this instance"
}
```

Ako vraća 200 ili kreira user → signup je accidentally enabled.

### Dashboard provjera

Periodicno provjeriti:

1. Authentication → Settings → Enable sign ups → OFF
2. Authentication → Users → samo Una + test (ako E2E user postoji)

## Lockdown checklist

Pri svakom nov deploy-u, provjeriti:

| Setting | Vrijednost |
|---------|-----------|
| `enable_signup` | false |
| `enable_anonymous_sign_ins` | false |
| `minimum_password_length` | 8 |
| `password_requirements` | `lower_upper_letters_digits` |
| Number of users | 1 (Una) + možda 1 (test) |
| `is_admin()` email | Una email |
| `ADMIN_EMAILS` env | Una email |

## Sledeće

- [auth.md](./auth.md) — login flow
- [is-admin.md](./is-admin.md) — DB whitelist
