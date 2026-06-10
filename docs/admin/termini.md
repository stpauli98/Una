# Admin: `/termini` — Upravljanje terminima

**Fajl:** `src/app/admin/(protected)/termini/page.tsx`

Glavna stranica admin panela. Una provodi najviše vremena ovdje.

## Šta Una vidi

### Header

- `PageHeader` sa "Termini" naslovom
- "Dodaj termin" dugme (otvara `ManualAppointmentForm` modal)

### Toolbar

| Element | Funkcija |
|---------|----------|
| Day picker | Skok na specifičan datum |
| Status filter | Sve / Čeka / Potvrđen / Otkazan / Završen |
| Sort toggle | Datum ▲ / Datum ▼ |
| Search | Po imenu klijenta |

### Lista termina

Grupisana po datumu. Svaki dan ima header sa datumom u srpskoj ijekavici:

```
SRIJEDA, 15. APRIL
─────────────────
17:30  Ana Petrović         Šminkanje       potvrđen  [...]
19:00  Jelena Brkić          Pedikir         čeka     [...]

ČETVRTAK, 16. APRIL
─────────────────────
18:00  Marija Marković       Trepavice       potvrđen  [...]
```

## AppointmentRow

**Fajl:** `src/components/admin/AppointmentRow.tsx`

Svaki red ima:

| Element | Sadržaj |
|---------|---------|
| Vrijeme | `17:30` (bold, rose) |
| Ime | `Ana Petrović` |
| Telefon | `+387 65 ...` (klikabilan tel: link) |
| Usluga | Naziv usluge |
| Status | `StatusBadge` (`ceka`, `potvrdjen`, ...) |
| Akcije | Set dugmadi zavisno od statusa |

### Akcije

| Status | Dostupna dugmad |
|--------|-----------------|
| `ceka` | Potvrdi · Otkaži · WhatsApp |
| `potvrdjen` | Završi · Otkaži · WhatsApp |
| `otkazan` | (Samo prikaz) · WhatsApp |
| `zavrsen` | (Samo prikaz) · WhatsApp |

### WhatsApp dugme

Generiše `wa.me` link sa **status-adaptivnom porukom** kroz `buildAppointmentWaMessage()`:

| Status | Poruka |
|--------|--------|
| `ceka` / `potvrdjen` | "Zdravo {ime}, Una iz UP Makeup ovdje. Potvrđujem vaš termin..." |
| `otkazan` | "Zdravo {ime}, Una ovdje. Nažalost moram otkazati vaš termin..." |
| `zavrsen` | "Zdravo {ime}, hvala vam što ste me posjetili!..." |

Fajl: `src/lib/utils/wa-messages.ts`

## Server actions

**Fajl:** `src/app/admin/(protected)/termini/actions.ts`

### `confirmAppointment(id: number)`

```typescript
UPDATE appointments
SET status = 'potvrdjen',
    confirmation_sent_at = NOW()
WHERE id = $1
```

Promjena statusa + revalidate (`/admin/termini`, `/admin/dashboard`).

### `cancelAppointment(id: number)`

```typescript
UPDATE appointments
SET status = 'otkazan'
WHERE id = $1
```

Slot se automatski oslobađa za sljedeće rezervacije (availability engine filtruje samo `ceka`/`potvrdjen`).

### `markCompleted(id: number)`

```typescript
UPDATE appointments
SET status = 'zavrsen'
WHERE id = $1
```

Za istorijska statistika.

### `createManualAppointment(formData)`

Za situaciju kad neko nazove ili dođe direktno u studio — Una može unijeti termin sa svoje strane.

Detalji: [manuelni-termin.md](./manuelni-termin.md)

## Filtriranje (URL params)

| Param | Default | Vrijednosti |
|-------|---------|-------------|
| `?date=YYYY-MM-DD` | Današnji | Bilo koji datum |
| `?status=...` | Sve | `ceka`, `potvrdjen`, `otkazan`, `zavrsen`, `sve` |
| `?sort=...` | `asc` | `asc`, `desc` |
| `?q=...` | (prazno) | Search query (po imenu) |

Toolbar dugmad update-uju URL kroz `router.push` — bookmarkable i shareable URL-ovi.

## Realtime updates

**Komponenta:** `AppointmentsRealtime` (`src/components/admin/AppointmentsRealtime.tsx`)

Subscribe-uje na `postgres_changes` za `appointments` tabelu:

```typescript
useEffect(() => {
  const channel = supabase
    .channel("appointments-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "appointments" },
      () => router.refresh(),
    )
    .subscribe();

  return () => { channel.unsubscribe(); };
}, []);
```

Kad klijent rezerviše (INSERT), Una vidi novi termin u listi unutar 1-2 sekunde.

Kad Una promijeni status iz drugog tab-a (UPDATE), oba tab-a se sinhronizuju.

## Email tracking (Phase 8, TODO)

Tri kolone postoje u `appointments` ali se ne koriste (Resend nije aktivan):

| Kolona | Šta označava |
|--------|--------------|
| `email_received_sent_at` | Email "Primili smo rezervaciju" poslan |
| `email_confirmed_sent_at` | Email "Una je potvrdila" poslan |
| `email_cancelled_sent_at` | Email otkazivanja poslan |

UI prikazuje email status (zelena kvačica ako poslan, siva crtica ako ne) — sad uvijek siva.

## Status counts u sidebar-u

Sidebar (kad mu Una pristupi `/admin/termini`) prikazuje count po statusu:

```
Sve (132)
Čeka (2)
Potvrđen (61)
Otkazan (0)
Završen (71)
```

Fetch: server komponenta `page.tsx` šalje count props u `TerminiStatusFilter`.

## Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Una pokuša potvrditi već potvrđen | Idempotentno — samo update timestamp |
| Una pokuša otkazati otkazan | Idempotentno |
| Email kolone se mijenjaju iz drugog tab-a | Realtime update |
| Konekcija prekinuta | Realtime se reconnect-uje automatski |
| Više od 100 termina | Lazy load / pagination (TBD — trenutno nema) |

## Sledeće

- [manuelni-termin.md](./manuelni-termin.md) — manuelni unos
- [realtime.md](./realtime.md) — realtime detalji
- [../booking-engine/availability.md](../booking-engine/availability.md) — kako se computa availability
