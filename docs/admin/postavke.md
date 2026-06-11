# Admin: `/admin/postavke` — Postavke

**Fajl:** `src/app/admin/(protected)/postavke/page.tsx`

Glavna stranica za podešavanja. 8 collapsible sekcija.

## Sekcije (collapsible)

Redoslijed na stranici (`page.tsx:147-222`):

| Sekcija | Komponenta | Šta podešava |
|---------|-----------|--------------|
| 1. Pravila rezervisanja | `BookingRulesEditor` | min_hours_before, advance_days, cancellation, break |
| 2. Radno vrijeme | `WorkingHoursEditor` | Po danu u sedmici |
| 3. Blokirani datumi | `BlockedDatesManager` | Cijeli dani van funkcije |
| 4. Blokirani intervali (sub-day) | `TimeBlocksManager` | Pod-dan (pauza, privatno) + sedmično ponavljanje |
| 5. Obavještenja na uređaju | `PushNotificationToggle` | Push subscribe/unsubscribe |
| 6. Email obavještenja | `EmailNotificationStatus` | Status Resend konfiguracije + test email |
| 7. Export podataka | `CsvExportButton` | CSV export svih termina |
| 8. Promjena lozinke | `ChangePasswordForm` | Promjena lozinke |

Svaka sekcija ima toggle (expanded/collapsed) — state je in-memory (React state u `CollapsibleSection`), ne perzistira se.

## 1. Radno vrijeme — `WorkingHoursEditor`

**Fajl:** `src/components/admin/WorkingHoursEditor.tsx`

7 redova (1 po danu, pon → ned).

### Mobile layout (2-row)

```
┌────────────────────────────┐
│  Ponedjeljak    [✓] Otvoreno│
│  [17:00] — [21:00] [Sačuvaj]│
└────────────────────────────┘
```

- Red 1: Dan + "Otvoreno" checkbox
- Red 2: Open time + Close time + Save dugme

### Desktop layout (1-row)

Sve u jednom redu, flex layout.

### Time selects

Dropdownovi sa **grid-aligned** vrijednostima:

```typescript
const TIME_OPTIONS = ["00:00", "00:30", "01:00", ..., "23:30"];
```

48 opcija (`00:00` do `23:30`, step 30 min). Niko ne može unijeti `17:15`.

### Save (inline)

Klik "Sačuvaj" pored reda → `updateWorkingHour(formData)` server action:

```typescript
UPDATE working_hours
SET open_time = $1, close_time = $2, is_open = $3
WHERE day_of_week = $4
```

Inline indikator "Sačuvano" se prikazuje 1.5s nakon save-a.

## 2. Blokirani dani — `BlockedDatesManager`

**Fajl:** `src/components/admin/BlockedDatesManager.tsx`

Lista postojećih + forma za novi blok.

### Forma

| Polje | Tip | Required |
|-------|-----|----------|
| Datum od | Date | ✅ (regex `^\d{4}-\d{2}-\d{2}$`) |
| Datum do | Date | ✅ |
| Razlog | Text | ❌ (max 200 char) |

Validation: `date_to >= date_from`.

### Server action

```typescript
INSERT INTO blocked_dates (date_from, date_to, reason)
VALUES (...)
```

Lista postojećih ima X dugme za delete.

### Use case

- "Godišnji odmor 1.7 – 15.7"
- "Renoviranje studija"
- "Praznik"

Klijent na `/zakazi` ne može izabrati datume u tom rasponu.

## 3. Vremenske blokade — `TimeBlocksManager`

**Fajl:** `src/components/admin/TimeBlocksManager.tsx`

Slično blokiranim danima, ali za pod-dan blokade.

### Forma

| Polje | Tip |
|-------|-----|
| Datum | `<input name="block_date" type="date">` |
| Od | `<select name="start_time_select">` (30-min grid) |
| Do | `<select name="end_time_select">` (30-min grid) |
| Razlog | Text (max 200 char) |

### Server action

```typescript
INSERT INTO time_blocks (start_time, end_time, reason)
VALUES (...)
```

`start_time` i `end_time` se konstruišu iz `block_date` + `start_time_select` u **Sarajevo timezone** kroz `parseSarajevoDateTime()`.

### Sedmično ponavljanje (recurrence)

**Implementirano** (`TimeBlocksManager.tsx:144-175`):

- Checkbox **"Ponavlja se svake sedmice"** u formi
- Kad je uključen, pojavljuje se input **"Do datuma"**
- Server kreira pojedinačne blokove za svaki isti dan u sedmici do izabranog datuma — svi dijele isti `recurrence_group_id` (UUID)
- Expansion logika: `expandWeeklyTimeBlocks()` u `src/lib/utils/recurring-blocks.ts` (max 260 ponavljanja ≈ 5 godina; `untilDate` ograničen na danas + 366 dana kroz `maxUntilDateStr()`)
- Lista grupiše blokove po `recurrence_group_id` i prikazuje broj ponavljanja; brisanje nudi uklanjanje cijelog serijala

Use case: "Pauza za ručak ponedjeljkom 13:00–14:00, do kraja godine."

### Anon privacy

`reason` polje sadrži potencijalno osjetljive informacije ("kod zubara", "privatno"). Anon korisnici **ne smiju** vidjeti razlog.

**Rješenje:** `time_blocks_public` view bez `reason` polja:

```sql
CREATE VIEW time_blocks_public AS
SELECT id, start_time, end_time FROM time_blocks;
```

Anon RLS dozvoljava SELECT na view, ne na bazu tabelu. Availability engine koristi view.

### Use case

- "Pauza za ručak 13:00–14:00"
- "Kod zubara 11:00–12:30"
- "Privatno (sin)"

Slot u tom intervalu neće biti dostupan za rezervacije.

## 4. Booking pravila — `BookingRulesEditor`

**Fajl:** `src/components/admin/BookingRulesEditor.tsx`

4 podešavanja sa dropdown-ima (opcije iz `BookingRulesEditor.tsx` RULES konstante):

| Setting | Default | UI opcije |
|---------|---------|-----------|
| `min_hours_before` | 24 | 0, 1, 2, 3, 6, 12, 24 (sati) |
| `advance_booking_days` | 90 | 7, 14, 30, 60, 90 (dana) |
| `cancellation_hours` | 24 | 0, 1, 2, 3, 6, 12, 24 (sati) |
| `break_between_min` | 0 | 0, 30, 60, 90, 120 (minuta) |

### Razlog za `break_between_min` opcije

Sve opcije su **multiple od 30** (slot interval) — server validacija u `postavke/actions.ts:308` eksplicitno odbija sve van `[0, 30, 60, 90, 120]`. Vrijednost poput 10 ili 15 min nije moguća jer bi razbila fiksni 30-min grid (slot generation bi imao gaps).

### Inline save

Svaki red ima svoj save dugme (kao radno vrijeme). Spremanje:

```typescript
UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2
```

## 5. Push notifikacije

**Komponenta:** `PushNotificationToggle`

Toggle "Push notifikacije" → poziva `subscribeToPush()` ili `unsubscribeFromPush()` server action.

Detalji: [pwa-push.md](./pwa-push.md)

## 6. Email obavještenja — `EmailNotificationStatus`

**Fajl:** `src/components/admin/EmailNotificationStatus.tsx` + `postavke/email-actions.ts`

Prikazuje status Resend email konfiguracije:

| Stanje | Prikaz |
|--------|--------|
| `RESEND_API_KEY` nije setovan | Amber upozorenje "Nije konfigurisano" |
| Konfigurisano | Zeleni status + maskirana admin adresa (`pe***@gmail.com`) |

Dugme **"Pošalji test email"** → `sendTestAdminEmail()` server action — šalje probni email na `ADMIN_NOTIFICATION_EMAIL` da Una/developer potvrdi da Resend radi. `getEmailNotificationConfig()` čita konfiguraciju server-side (API key se nikad ne šalje klijentu).

Detalji o tome KOJI email-ovi se šalju i kada: [email-notifikacije.md](./email-notifikacije.md)

## 7. Export podataka — `CsvExportButton`

**Fajl:** `src/components/admin/CsvExportButton.tsx` + `postavke/export-actions.ts`

CSV export svih termina za backup ili porezni izvještaj:

- Dropdown za izbor godine ("Sve godine" + lista godina u kojima postoje termini — `availableYears` se računa server-side u `page.tsx` iz min/max `start_time`)
- Dugme "Preuzmi CSV" → `exportAppointmentsCsv(year?)` server action → browser download
- Format: **semicolon (`;`) separator + UTF-8 sa BOM** — otvara se ispravno u Excel-u (EU locale) i LibreOffice Calc-u
- CSV builder: `src/lib/utils/csv.ts` (unit testiran u `tests/unit/csv.test.ts`)

## 8. Promjena lozinke — `ChangePasswordForm`

**Fajl:** `src/components/admin/ChangePasswordForm.tsx`

Forma sa:
- Trenutna lozinka (verifikacija)
- Nova lozinka
- Potvrda nove

### Validacija

Server-side u `changePassword(newPassword)`:

```typescript
if (newPassword.length < 8)
  return { ok: false, error: "Min 8 karaktera" };
if (!/[A-Z]/.test(newPassword))
  return { ok: false, error: "Mora imati veliko slovo" };
if (!/[a-z]/.test(newPassword))
  return { ok: false, error: "Mora imati malo slovo" };
if (!/\d/.test(newPassword))
  return { ok: false, error: "Mora imati cifru" };
```

### Auth update

```typescript
const { error } = await sb.auth.updateUser({ password: newPassword });
```

Supabase enforce-uje policy iz config.toml (`password_requirements = "lower_upper_letters_digits"`).

## Admin preferences (localStorage)

Collapse state sekcija na ovoj stranici se **ne perzistira** — čisti React state u `CollapsibleSection`.

`AdminPrefsPersister` (`src/components/admin/AdminPrefsPersister.tsx`) perzistira nešto drugo — filtere drugih admin stranica:

| Ključ | Sadržaj |
|-------|---------|
| `up-admin-termini-prefs` | JSON: izabrani datum/range, status filter, sort smjer za `/admin/termini` |
| `up-admin-dashboard-date` | Izabrani dan na `/admin/dashboard` |

Restoration na mount-u — admin se vraća na stranicu i zatiče iste filtere.

## Cache invalidation

Svaka mutacija → `revalidatePath("/admin/postavke")` + relevantni javni path-ovi (`/`, `/zakazi`).

`/api/availability` ne treba revalidate (force-dynamic).
