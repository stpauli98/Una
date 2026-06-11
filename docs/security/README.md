# Sigurnost — pregled

Sve sigurnosne mjere primijenjene u UP Makeup projektu.

## Defense in depth — 5 slojeva

```
┌────────────────────────────────────────┐
│  1. Network layer (Vercel + Cloudflare)│
│     - HTTPS, DDoS, security headers    │
├────────────────────────────────────────┤
│  2. Application layer                  │
│     - Rate limiting, input validation  │
├────────────────────────────────────────┤
│  3. Authorization                      │
│     - proxy.ts auth guard              │
│     - requireAdmin() server actions    │
├────────────────────────────────────────┤
│  4. Database RLS                       │
│     - is_admin() + politike            │
├────────────────────────────────────────┤
│  5. Database constraints               │
│     - Exclusion, CHECK, unique         │
└────────────────────────────────────────┘
```

Svaki napad mora probiti **sve slojeve** da bi bio uspjesan.

## Glavne sigurnosne kategorije

| Tema | Fajl | Šta pokriva |
|------|------|-------------|
| RLS politike | [rls-policies.md](./rls-policies.md) | Row-level security na svim tabelama |
| `is_admin()` funkcija | [is-admin.md](./is-admin.md) | Postgres function za JWT email check |
| Autentikacija | [auth.md](./auth.md) | Login flow, JWT, whitelist |
| Rate limiting | [rate-limiting.md](./rate-limiting.md) | Upstash Redis + in-memory fallback |
| File upload | [file-upload.md](./file-upload.md) | Sharp validation, magic bytes |
| HTTP headers | [headers.md](./headers.md) | X-Frame-Options, CSP, itd. |
| Signup disabled | [signup-disabled.md](./signup-disabled.md) | Niko ne može kreirati nalog |

## Brzi pregled — security checklist

| Kontrola | Status |
|----------|--------|
| ✅ HTTPS enforced | Da (Vercel automatski) |
| ✅ Strict-Transport-Security | Da |
| ✅ X-Frame-Options: DENY | Da |
| ✅ X-Content-Type-Options: nosniff | Da |
| ✅ Referrer-Policy | Da |
| ✅ Permissions-Policy | Da (kamera, mikrofon, geo disabled) |
| ✅ RLS uključen na svim tabelama | Da |
| ✅ Anon INSERT ograničen | `status='ceka'`, `status='novi'` |
| ✅ Admin email whitelist | Da |
| ✅ Rate limit booking | 5/min/IP |
| ✅ Rate limit availability | 30/min/IP |
| ✅ Password complexity | 8+ char, mixed case, digit |
| ✅ Signup disabled (Supabase) | Da |
| ✅ File upload validacija | Magic bytes + dimensions |
| ✅ Server-only admin client | "server-only" import |
| ✅ Confirmation token UUID | Da (anti-IDOR) |
| ✅ DB exclusion constraint | no_overlapping_appointments |
| ✅ Service role key tajan | Nije eksponiran klijentu |
| ✅ .env.local u gitignore | Da |

## Threat model — šta sajt ne adresira

| Threat | Mitigation | Status |
|--------|-----------|--------|
| DDoS | Vercel + Cloudflare | ✅ Auto |
| SQL injection | Parametrized queries (Supabase client) | ✅ Built-in |
| XSS | React auto-escape | ✅ Built-in |
| CSRF | Server actions same-origin | ✅ Next.js |
| Brute force login | Rate limit (Supabase) | ⚠️ Granular limits TBD |
| Account takeover | Strong password + signup disabled | ✅ |
| Privilege escalation | requireAdmin() + RLS | ✅ |
| Data exfiltration | RLS + admin client server-only | ✅ |
| Malicious upload | Sharp + magic bytes | ✅ |
| Bot scraping | Robots.txt + noindex success | ⚠️ Nije forsiran |
| Insider threat | N/A (samo Una je admin) | N/A |

## Sigurnosni incident response

Ako se desi incident:

1. **Detekcija** — provjeriti Supabase logs (Dashboard → Logs)
2. **Containment** — promijeniti passwords, rotirati VAPID/Resend keys, blokirati IP
3. **Eradication** — patch vulnerability
4. **Recovery** — restore from backup ako treba (Supabase ima daily backup)
5. **Lessons learned** — dokumentovati u `docs/superpowers/plans/`

## Sigurnosni logging — PII sanitizacija

**Fajl:** `src/lib/utils/log.ts` → `sanitizeError()` (unit testovi: `tests/unit/log.test.ts`, 9 testova)

Postgres error-i mogu sadržati telefon/email klijenta u `details` polju (npr. unique constraint violation poruke). Vercel runtime logovi se čuvaju mjesecima i vidljivi su cijelom timu — PII ne smije curiti tamo.

`sanitizeError()` prije svakog `console.error`:
- Regex zamjena email adresa → `[email]`
- Regex zamjena telefona → `[phone]`
- Skida trailing quoted vrijednosti iz Postgres poruka
- Zadržava `code` (npr. `23P01`) za debugging

Koristi se u booking flow-u, admin akcijama i API rutama.

## Periodicno održavanje

| Šta | Učestalost |
|-----|------------|
| `npm audit` | Mjesecno |
| Update dependencies | Kvartalno |
| Review RLS policies | Pri dodavanju nove tabele |
| Rotate Supabase service role key | Godišnje (ili pri sumnji) |
| Review admin email whitelist | Pri promjeni timski |
| Review Vercel env vars | Pri svakom deploy-u (provjeriti da nisu istekli) |

## Audit istorija

Glavne security migracije:

| Migracija | Šta dodaje |
|-----------|------------|
| `20260411100000_no_overlapping` | DB exclusion constraint |
| `20260411100001_confirmation_token` | UUID anti-IDOR |
| `20260422_tighten_rls` | Anon INSERT WITH CHECK |
| `20260427000001_storage_policies` | Storage RLS |
| `20260518000001_push_subscriptions` | RLS na push subs |
| `20260527000000_security_hardening` | `is_admin()` funkcija + sve admin-only RLS |

Detalji svake: [../reference/migrations-list.md](../reference/migrations-list.md)
