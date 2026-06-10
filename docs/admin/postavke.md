# Admin: `/admin/postavke` — Postavke

**Fajl:** `src/app/admin/(protected)/postavke/page.tsx`

Glavna stranica za podešavanja. 6 collapsible sekcija.

## Sekcije (collapsible)

| Sekcija | Komponenta | Šta podešava |
|---------|-----------|--------------|
| 1. Radno vrijeme | `WorkingHoursEditor` | Po danu u sedmici |
| 2. Blokirani dani | `BlockedDatesManager` | Cijeli dani van funkcije |
| 3. Vremenske blokade | `TimeBlocksManager` | Pod-dan (pauza, privatno) |
| 4. Booking pravila | `BookingRulesEditor` | min_hours_before, advance_days, break, cancellation |
| 5. Push notifikacije | `PushNotificationToggle` | Subscribe/unsubscribe |
| 6. Lozinka | `ChangePasswordForm` | Promjena lozinke |

Svaka sekcija ima toggle (expanded/collapsed) — state se cuva u `localStorage` (per-sekcija).

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

### Recurrence (opciono)

`recurrence_group_id` UUID kolona omogućava grupisanje recurrent blokova. UI još uvijek nije implementiran za kreiranje recurrentnih (TBD).

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

4 podešavanja sa dropdown-ima:

| Setting | Default | Opcije |
|---------|---------|--------|
| `min_hours_before` | 24 | 0, 6, 12, 24, 48, 72 |
| `advance_booking_days` | 90 | 7, 14, 30, 60, 90, 180, 365 |
| `cancellation_hours` | 24 | 0, 6, 12, 24, 48 |
| `break_between_min` | 0 | 0, 30 (samo grid-aligned!) |

### Razlog za `break_between_min` opcije

Originalno je bilo `[0, 5, 10, 15, 30]` — ali 5/10/15 nije grid-aligned (30-min grid). Trip — slot generation bi imao gaps.

**Rješenje:** Samo `[0, 30]`. Ako Una hoće 10-min pauzu — to ne radi sa fiksnim 30-min grid-om.

### Inline save

Svaki red ima svoj save dugme (kao radno vrijeme). Spremanje:

```typescript
UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2
```

## 5. Push notifikacije

**Komponenta:** `PushNotificationToggle`

Toggle "Push notifikacije" → poziva `subscribeToPush()` ili `unsubscribeFromPush()` server action.

Detalji: [pwa-push.md](./pwa-push.md)

## 6. Promjena lozinke — `ChangePasswordForm`

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

## Collapsible state (localStorage)

`AdminPrefsPersister` (`src/components/admin/AdminPrefsPersister.tsx`) sluša izmjene i sprema u localStorage:

```typescript
localStorage.setItem("admin-postavke-collapse", JSON.stringify({
  workingHours: true,
  blockedDates: false,
  // ...
}));
```

Restoration na mount-u.

## Cache invalidation

Svaka mutacija → `revalidatePath("/admin/postavke")` + relevantni javni path-ovi (`/`, `/zakazi`).

`/api/availability` ne treba revalidate (force-dynamic).
