# Confirmation token — anti-IDOR

`/zakazi/uspjesno?token=<UUID>` umjesto `?id=42`. Sprjecava enumeration tuđih termina.

## Problem

**IDOR (Insecure Direct Object Reference):**

Bez tokena:
- Klijent A rezerviše → success URL: `/zakazi/uspjesno?id=42`
- Klijent A pamti URL
- Klijent A mijenja `id=42` u `id=41`, `id=40`, ...
- Klijent A vidi tuđe rezervacije (ime, telefon, usluga, vrijeme)

## Rješenje

UUID generisan kod insert-a, koristi se umjesto sekvencijalnog ID-a u URL-u.

### Database

**Migracija:** `supabase/migrations/20260411100001_confirmation_token.sql`

```sql
ALTER TABLE appointments
  ADD COLUMN confirmation_token UUID;

CREATE UNIQUE INDEX idx_appointments_confirmation_token
  ON appointments (confirmation_token)
  WHERE confirmation_token IS NOT NULL;
```

UNIQUE index (partial — samo non-null) za fast lookup.

### Generisanje

`createAppointment()` u `src/app/zakazi/actions.ts`:

```typescript
const confirmationToken = crypto.randomUUID();

const { data: inserted, error } = await sb
  .from("appointments")
  .insert({
    // ...
    confirmation_token: confirmationToken,
  })
  .select("id")
  .single();

redirect(`/zakazi/uspjesno?token=${confirmationToken}`);
```

`crypto.randomUUID()` (Web Crypto API):
- 128-bit entropy
- UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- Statistički nemoguće pogoditi (1 u 5.3×10³⁶)

### Lookup na success stranici

`src/app/zakazi/uspjesno/page.tsx`:

```typescript
type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UspjesnoPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) notFound();

  const sb = createAdminClient();
  const { data: appointment } = await sb
    .from("appointments")
    .select("id, start_time, client_name, service_id, services(name, price)")
    .eq("confirmation_token", token)  // ← UUID, ne sekv. ID
    .maybeSingle();

  if (!appointment) notFound();

  return (...);
}
```

`maybeSingle()` vraca `null` ako token ne match-uje → `notFound()` (404).

## Da li se token re-koristi

Ne. Klijent koji ima validan token može svaki put posjetiti success URL i vidjeti detalje:

```
GET /zakazi/uspjesno?token=abc-def-...
```

Token ne expire-uje. To je trade-off:
- ✅ Klijent može refresh-ovati URL nakon par dana
- ⚠️ Ako tuđi telefon ima ovaj URL u historiji, vidi detalje

Akteptirano jer je token statistički nepogodljiv.

## Šta klijent vidi

```
✓ Termin primljen

Vaša rezervacija
ŠMINKANJE
srijeda, 15. april · 17:30
Na ime: Ana Petrović

[Pošaljite poruku Uni]  (WhatsApp)
[Pozovi]  [Instagram]
```

Klijent ne vidi:
- Telefon (osim svoj)
- Email
- Druge termine

## Razlika od auth-protected

Klijenti **nisu autentifikovani**. Token služi kao "ulaznica" — ko ga ima, vidi termin.

Ako bi klijenti imali nalog, mogli bismo koristiti `auth.uid()` umjesto tokena. Ali za beauty studio, login je overkill.

## Token enumeration prevention

| Attack | Sprjecavanje |
|--------|--------------|
| Sequential ID enumeration | ✅ UUID umjesto ID |
| UUID guess | ✅ Statistički nemoguć (1 u 5.3×10³⁶) |
| URL share | ⚠️ Mogući (intentional) |
| Brute force | ⚠️ Rate limit na `/zakazi/uspjesno` (TBD — nije implementiran) |

## Robots.txt + noindex

Success URL je dodatno protected od Google indexing-a:

### robots.ts

```typescript
{
  rules: {
    userAgent: "*",
    disallow: ["/admin/", "/api/", "/zakazi/uspjesno"],
  },
}
```

### Page metadata

```typescript
export const metadata: Metadata = {
  title: "Termin primljen",
  robots: { index: false, follow: false },
};
```

Google ne indeksira success stranice. Ako klijent post-uje URL na Twitter, nije moguće pretraživati.

## Migracija old → new

Stari termini (prije migracije `20260411100001`) imaju `confirmation_token = NULL`. Stari URL `?id=42` više ne radi (success page traži `?token=...`).

Klijenti koji su rezervisali prije migracije:
- Ne mogu posjetiti svoj success URL više
- Una može dati info kroz WhatsApp

To je akceptirano jer je migracija bila ranije razvoja, prije bilo kakvih pravih rezervacija.

## Test

`tests/e2e/booking.spec.ts`:

```typescript
await expect(page).toHaveURL(/\/zakazi\/uspjesno\?token=[\w-]+/);
```

Regex provjerava format UUID-a u URL-u (bez tačno match-uje vrijednosti).

`tests/e2e/data-integrity.spec.ts`:

```typescript
const row = await getAppointmentByName(uniqueName);
expect(row.confirmation_token).toBeTruthy();
```

Provjerava da je token persistirana u bazi.

## Edge cases

| Situacija | Šta se desi |
|-----------|-------------|
| Token nepostojeći | 404 |
| Token expired | N/A (ne expire-uje) |
| Token re-iskorišten | Vidi svaki put |
| Token format nije UUID | Lookup `.eq("confirmation_token", "invalid")` → `null` → 404 |
| Token za otkazan termin | Vidi se sa status info (TBD prikazati otkazivanje vidno) |

## Sledeće

- [../security/auth.md](../security/auth.md) — admin auth (drugačija od ove)
- [../public/zakazi.md](../public/zakazi.md) — success page UI
