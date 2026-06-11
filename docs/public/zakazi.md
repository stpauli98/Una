# `/zakazi` — Booking flow

3-step flow za rezervaciju termina. Najkompleksnija javna stranica.

## URL i parametri

| URL | Šta radi |
|-----|----------|
| `/zakazi` | Defaultni step 1 (izbor usluge) |
| `/zakazi?service=1` | Skoči direktno na step 2 sa pre-selected uslugom |
| `/zakazi/uspjesno?token=<uuid>` | Success stranica nakon rezervacije |

## Komponente

| Komponenta | Fajl | Šta radi |
|-----------|------|----------|
| `BookingFlow` | `src/components/booking/BookingFlow.tsx` | Orchestrator — drži state, switching između step-ova |
| `ProgressIndicator` | `src/components/booking/ProgressIndicator.tsx` | 3 kružića na vrhu (1 → 2 → 3) |
| `StepServices` | `src/components/booking/StepServices.tsx` | Step 1: izbor usluge |
| `StepCalendar` | `src/components/booking/StepCalendar.tsx` | Step 2: izbor datuma + slot-a |
| `StepDetails` | `src/components/booking/StepDetails.tsx` | Step 3: forma + submit |

## Step 1 — Izbor usluge

**Komponenta:** `StepServices.tsx`

### Šta klijent vidi

- Naslov: "Izaberite uslugu"
- Lista svih `services` gdje je `bookable=true AND active=true`, grupisana po kategoriji
- Svaka usluga ima: naziv, cijena, trajanje, kratki opis

### Data fetching

Server-side (RSC u `page.tsx`):

```typescript
const { data: services } = await supabase
  .from("services")
  .select("*")
  .eq("active", true)
  .eq("bookable", true)
  .order("order_index");
```

### Akcija

Klik na uslugu:
- Update state-a u `BookingFlow` (`selectedServiceId`)
- Prijelaz na Step 2

Ako `?service=N` query param postoji, BookingFlow automatski skoči na Step 2.

### Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Nema bookable usluga | Empty state: "Trenutno nema dostupnih usluga" |
| Usluga ima `variable_price=true` | Cijena se prikazuje kao `price_note` (npr. "od 80 KM") |
| Usluga ima `duration_note` | Prikazuje se umjesto raw trajanja |

## Step 2 — Izbor termina

**Komponenta:** `StepCalendar.tsx`

### Šta klijent vidi

Header sa: imenom izabrane usluge, trajanjem, dugmetom "Promijeni uslugu" (back).

Kalendar mjeseca:
- 7 kolona (pon–ned)
- Datumi koji nisu dostupni: disabled (`text-cream cursor-not-allowed`)
- Datum sa slobodnim slotovima: enabled
- Trenutno izabrani: highlighted
- Today indikator

Klik na datum → ispod kalendara prikazuje listu slotova: `17:00`, `17:30`, `18:00`...

### Data fetching

**Mjesečna availability** (za disabled state svakog datuma):

```
GET /api/availability/month?year=2026&month=6&service_id=1
→ { availableDates: ["2026-06-03", "2026-06-04", ...] }
```

**Dnevna availability** (kad klijent klikne datum):

```
GET /api/availability?date=2026-06-03&service_id=1
→ { slots: [{ start: "...", end: "..." }, ...] }
```

Obje rute u `src/app/api/availability/`. Računaju kroz `computeAvailableSlots()` — pure function u `src/lib/booking/availability.ts`.

### Logika

Slot je dostupan ako:
1. Datum je unutar `advance_booking_days` (default 90)
2. Datum nije u `blocked_dates`
3. Slot start je `>=` `now + min_hours_before` (default 24h)
4. Slot ne overlap-uje sa postojećim termin-ima (status `ceka` ili `potvrdjen`)
5. Slot ne overlap-uje sa `time_blocks` (pod-dan blokade)
6. Slot je unutar `working_hours` za taj dan u sedmici

Sve detalje vidi [booking-engine/availability.md](../booking-engine/availability.md).

### Loading states

- Dok se mjesečna avail. fetcha: kalendar disabled, spinner
- Dok se dnevna avail. fetcha: ispod kalendara "Učitavanje slotova..."
- Nakon: render dugmad

### Akcija

Klik na slot → update `BookingFlow.selectedSlot` → prijelaz na Step 3.

### Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Datum ima 0 slotova | Empty state: "Nema slobodnih termina za ovaj dan" |
| Klijent klikne back | Vraća na Step 1, čuva izbor usluge |
| Klijent klikne disabled datum | Nema reakcije |
| Slot postane zauzet dok klijent bira | Pojavi se kao zauzet na sljedeći refresh, ali ne aktivno blokira UI |

## Step 3 — Forma + submit

**Komponenta:** `StepDetails.tsx`

### Šta klijent vidi

Header sa pregled izbora (usluga + termin + datum).

Forma sa poljima:

| Polje | Tip | Required | Validacija |
|-------|-----|----------|------------|
| Ime i prezime | text | ✅ | 2–100 char |
| Telefon | tel | ✅ | `libphonenumber-js` (BA + international) |
| Email | email | ❌ | Validni email ili prazno |
| Napomena | textarea | ❌ | Max 500 char |
| Saglasnost | checkbox | ✅ | Mora biti `true` |

Submit dugme: "Potvrdi rezervaciju".

Link "Promijeni termin" za back na Step 2.

### Akcija — submit

`onSubmit` (React, ne `<form action>`) sa `preventDefault()`:

```typescript
async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  fd.set("service_id", String(selectedServiceId));
  fd.set("start_time", selectedSlot.start.toISOString());
  const result = await createAppointment(fd);
  if (!result.ok) {
    setError(result.error);
    setFieldErrors(result.fieldErrors);
    // VAŽNO: forma ostaje popunjena, ne resetuje
  }
  // ako result.ok → redirect na /zakazi/uspjesno?token=...
}
```

**Razlog za `onSubmit` umjesto `action`:** React 19 `<form action>` automatski resetuje formu na success/error. Klijent gubi sve unesene podatke ako se greška desi. `onSubmit` sa `preventDefault` to izbjegava.

### Server-side flow

`createAppointment(formData)` u `src/app/zakazi/actions.ts`:

1. **Rate limit** — 5 booking attempts/min per IP (Upstash ili in-memory)
2. **Zod validacija** — `bookingFormSchema.safeParse(raw)`
3. **Service check** — fetch iz baze, provjera `bookable` i `active`
4. **Grid alignment** — `isGridAligned(start)` (mora `:00` ili `:30`)
5. **Min hours before** — `differenceInHours(start, nowSarajevo()) >= minHoursBefore`
6. **Race guard** — SELECT za clash, return error ako postoji
7. **Insert** — sa `status: "ceka"`, `confirmation_token: crypto.randomUUID()`
8. **Redirect** — `redirect("/zakazi/uspjesno?token=" + token)`

DB exclusion constraint (`no_overlapping_appointments`) je **hard guarantee** ako race guard ne uhvati. Insert će failed-ovati ako tačno u tom milisekundu drugi klijent već unese isti slot.

Detalji: [../booking-engine/race-conditions.md](../booking-engine/race-conditions.md)

### Field errors

`bookingFormSchema` vraća `fieldErrors` po polju ako neka validacija ne prođe:

```typescript
{
  ok: false,
  error: "Molimo provjerite podatke u formi",
  fieldErrors: {
    client_name: ["Unesite ime i prezime"],
    client_phone: ["Neispravan broj telefona..."],
  }
}
```

UI prikazuje crveni tekst ispod polja sa odgovarajućim errorom.

### Edge case-ovi

| Situacija | Server vraća | UI prikazuje |
|-----------|-------------|--------------|
| Polje prazno | Field error | "Unesite..." crveno |
| Nepostojeća usluga | "Usluga nije pronađena" | Toast |
| Slot vec zauzet (race) | "Ovaj termin je upravo zauzet..." | Toast + back na Step 2 |
| `start < now + min_hours_before` | "Rezervacija mora biti najmanje 24h unaprijed" | Toast |
| Rate limit overflow | "Previše zahtjeva..." | Toast |
| Network failure | Exception | "Došlo je do greške..." |

## Step 4 — Success stranica

**URL:** `/zakazi/uspjesno?token=<uuid>`

**Fajl:** `src/app/zakazi/uspjesno/page.tsx`

### Šta klijent vidi

- Checkmark ikona
- "Termin primljen"
- Detalji rezervacije (usluga, datum, vrijeme, ime)
- WhatsApp dugme za potvrdu kod Une
- Telefon dugme
- Instagram dugme

### Data fetching

```typescript
const { data: appointment } = await sb
  .from("appointments")
  .select("id, start_time, client_name, service_id, services(name, price, price_note)")
  .eq("confirmation_token", token)  // ← UUID, NE sekv. ID
  .maybeSingle();

if (!appointment) notFound();
```

### Anti-IDOR zaštita

URL koristi `?token=<UUID>` umjesto `?id=42`. Klijent ne može enumerisati tuđe termine. Detalji: [../booking-engine/confirmation-token.md](../booking-engine/confirmation-token.md)

### Metadata

```typescript
robots: { index: false, follow: false }
```

Google neće indeksirati success stranice. `robots.txt` takođe disallow-uje `/zakazi/uspjesno`.

### WhatsApp message format

Generisan kroz `buildAppointmentWaMessage()`:

> Zdravo Una, upravo sam rezervisao/la termin za Šminkanje u srijeda, 5. juni u 17:30. Ime: Ana Petrović.

Klik na WhatsApp dugme → otvori `wa.me/38765810323?text=<encoded>` → klijent samo klikne "Send" u WhatsApp app.

## Booking pravila — sažetak

| Pravilo | Default | Promjenljivo |
|---------|---------|--------------|
| Slot interval | 30 min | ❌ |
| Min hours before | 24h | ✅ |
| Max days ahead | 90 dana | ✅ |
| Break between | 0 min | ✅ |
| Cross-service blocking | Sve usluge blokiraju sve | ❌ |

## Sigurnost

| Mjera | Lokacija |
|-------|----------|
| Rate limit (5/min/IP) | `createAppointment()` početak |
| Zod schema validation | `bookingFormSchema` |
| Server-side grid alignment | `isGridAligned()` |
| Server-side min_hours_before | `differenceInHours()` check |
| Race guard | SELECT prije INSERT |
| DB exclusion constraint | Migracija `20260411100000` |
| Confirmation token UUID | `crypto.randomUUID()` |

## Sledeće

- [../booking-engine/availability.md](../booking-engine/availability.md) — detalje slot logike
- [../booking-engine/race-conditions.md](../booking-engine/race-conditions.md) — kako sprečavamo dupli booking
- [../security/rls-policies.md](../security/rls-policies.md) — RLS politike za `appointments`
