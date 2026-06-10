# Admin: Manuelni termin (ManualAppointmentForm)

**Fajl:** `src/components/admin/ManualAppointmentForm.tsx`

Modal forma za situaciju kad klijent zove telefonom ili dođe direktno u studio. Una unosi termin sa svoje strane.

## Trigger

Otvara se sa **"Dodaj termin"** dugme u `/admin/termini` ili `/admin/dashboard`.

## UI

Modal sa formom u 2 koraka (mental model):

### Korak 1 — Izbor usluge + klijent

| Polje | Tip |
|-------|-----|
| Usluga | Select (`<select>`) sa svim aktivnim |
| Ime klijenta | Text |
| Telefon | Tel |
| Email | Email (opciono) |
| Napomena | Textarea (opciono) |

### Korak 2 — Datum + vrijeme

2 moda:

#### Mod A: "Slobodni termini" (default)

- Date picker (`<input type="date">`)
- Slot grid (fetcha `/api/availability?date=...&service_id=...&admin=true`)
- Klik na slot

`admin=true` query param skip-uje `min_hours_before` check (admin može unijeti termin "danas").

#### Mod B: "Prilagođeno vrijeme"

Toggle dugme "Prilagođeno vrijeme":

- Date picker (`<input type="date" name="custom_date">`)
- Time dropdown (`<select name="custom_time">` — sve grid-aligned vrijednosti 00:00–23:30)

**Use case:** Una hoće unijeti termin van standardnog radnog vremena (specijalan dogovor).

## Submit

```typescript
async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  // Construct start_time iz date + time fields (Sarajevo TZ)
  const result = await createManualAppointment(fd);
  if (result.ok) {
    onClose();
    router.refresh();
  } else if (result.conflict) {
    // Konflikt — pokaži warning sa force opcijom
    setShowConflictDialog(true);
  } else {
    setError(result.error);
  }
}
```

### `createManualAppointment` server action

**Fajl:** `src/app/admin/(protected)/termini/actions.ts`

1. `requireAdmin()`
2. Zod validation (`manualAppointmentSchema` — bez `consent` polja, ima `force`)
3. Service check
4. Grid alignment (`isGridAligned`)
5. Konflikt detekcija (ako `force=false`):
   - SELECT termina koji overlap-uju
   - Ako postoji clash, vrati `{ conflict: true, ok: false }`
6. Insert sa `status: "potvrdjen"` (auto-confirmed za admin)

```typescript
INSERT INTO appointments (
  service_id, client_name, client_phone, client_email,
  start_time, end_time, notes, status
) VALUES (..., 'potvrdjen')
```

### Force override

Ako Una vidi konflikt warning ali svejedno hoće unijeti:

```typescript
fd.set("force", "true");
await createManualAppointment(fd);
```

Sa `force=true`:
- Konflikt provjera se preskače
- DB exclusion constraint i dalje radi (ako pravi overlap, INSERT fail-uje)

**Upozorenje za Unu:** "Postoji konflikt sa terminom {ime}. Možete svejedno dodati ako želite." → checkbox "Force unos" → resubmit.

## Schema razlika

| Polje | `bookingFormSchema` (klijent) | `manualAppointmentSchema` (admin) |
|-------|-------------------------------|-----------------------------------|
| `consent` | ✅ Required `true` | ❌ Nije polje |
| `force` | ❌ Nije polje | ✅ Optional `boolean` |
| Status nakon insert-a | `ceka` | `potvrdjen` |
| Min hours before | Forsiran | Skip-ovan (admin=true) |
| Confirmation token | Generiše se | Generiše se |

## Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Konflikt + force=false | "Konflikt — možete svejedno dodati" |
| Konflikt + force=true | INSERT (osim ako DB constraint fail) |
| Slot ne grid-aligned | "Vrijeme mora biti na pun sat ili pola" |
| Usluga inactive | "Usluga nije pronađena" |
| Klijent bez emaila | OK (`client_email` je opcional) |
| Una popuni i pa back | State se ne čuva — modal reset |
