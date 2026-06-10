# Admin: `/admin/usluge` — Usluge CRUD

**Fajl:** `src/app/admin/(protected)/usluge/page.tsx`, `src/components/admin/ServicesManager.tsx`

CRUD interfejs za usluge.

## Šta Una vidi

### Header

- `PageHeader` "Usluge"
- "Nova usluga" dugme (gore desno)

### Grupisano po kategorijama

Same kao na `/usluge` javnoj stranici — grupisanje po kategoriji sa headerima:

- Šminkanje
- Pedikir
- Trepavice
- Obuka

Unutar svake kategorije: grid `md:grid-cols-2 lg:grid-cols-3` sa karticama usluga.

### Service card (admin)

| Element | Sadržaj |
|---------|---------|
| Kategorija eyebrow | "TREPAVICE" |
| Naziv | "Trepavice 1:1" |
| Cijena | "60 KM" (rose) |
| Trajanje | "180 min" (light) |
| Status indikator | Greyed out ako `active=false` |
| Reorder strelice | ↑ ↓ (move up/down) |
| "Izmijeni" dugme | Otvara `ServiceForm` |
| Eye/EyeOff dugme | Toggle `active` |

## Forma — `ServiceForm.tsx`

Otvara se kao modal (preko `<dialog>` ili portal).

### Polja

| Polje | Tip | Required | Constraint |
|-------|-----|----------|-----------|
| Kategorija | Select | ✅ | sminkanje/pedikir/trepavice/obuka |
| Naziv | Text | ✅ | 2–100 char |
| Opis | Textarea | ❌ | Max 500 |
| Cijena | Number | ✅ ili `variable_price` | > 0 |
| `variable_price` checkbox | Checkbox | ❌ | Ako true, `price_note` zamjenjuje cijenu |
| `price_note` | Text | Uvjetno | Prikazuje se umjesto cijene (npr. "od 80 KM") |
| Trajanje (min) | Select | ✅ ili `duration_note` | 30, 60, 90, 120, ..., 240 |
| `duration_note` | Text | Uvjetno | Prikazuje se umjesto trajanja (npr. "po dogovoru") |
| `bookable` | Checkbox | ❌ | Default true |
| `featured` | Checkbox | ❌ | Default false (top na `/usluge`) |
| `active` | Checkbox | ❌ | Default true |
| Slika | File upload | ❌ | Sharp validation |

### Trajanje — dropdown sa fiksnim vrijednostima

```typescript
const ALLOWED_DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];
```

Forsiramo grid-aligned vrijednosti. Free `<input type="number">` bi dozvolio bilo šta (npr. 45 min) što bi razbilo 30-min grid.

### Smart submit cleanup

```typescript
// Ako variable_price = true, ne šalji price (uvijek 0)
// Ako duration_note = empty, šalji duration_min (i obratno)
const payload = {
  ...formData,
  price: variable_price ? 0 : Number(formData.price),
  duration_min: duration_note ? null : Number(formData.duration_min),
};
```

## Server actions

**Fajl:** `src/app/admin/(protected)/usluge/actions.ts`

### `createService(formData)`

INSERT u `services` tabelu. `order_index` se postavlja na `max + 1` u kategoriji.

### `updateService(id, formData)`

UPDATE postojeće.

### `deleteService(id)`

Hard delete. **Pažnja:** Ako postoje `appointments` za ovu uslugu, `ON DELETE RESTRICT` constraint sprjecava brisanje. UI prikazuje grešku.

Alternativa: Una može toggle-ovati `active=false` umjesto brisanja.

### `reorderService(id, direction: "up" | "down")`

Mijenja `order_index` sa susjednom uslugom (swap).

```typescript
// Naprostije: SELECT current + neighbor, swap order_index
```

### `toggleServiceActive(id, active: boolean)`

Update `active` polja.

## UI bug fix istorija (FYI)

**Problem:** `ServicesManager` koristio `useState(initialServices)` koji "freezuje" snapshot na mount-u. Nakon edita, kartice prikazivale stare podatke dok se cijela stranica ne refreshuje.

**Fix:** Koristi `props` direktno (`services = initialServices`), bez `useState`. `router.refresh()` poslije svake mutacije triggeruje re-fetch i prop update.

## Slika usluge

Optional. Upload kroz `ServiceForm`:
1. Client compress (sharp/browser-image-compression)
2. Server: validate sa `sharp` (max 4096px, max 5MB)
3. Convert to WebP
4. Upload u `services` storage bucket
5. Save `image_path` u DB

Public sajt ne koristi ove slike trenutno (ServiceCard koristi samo ikone) — ali pripremljeno za buduće.

## Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Delete usluga sa terminima | ERROR ("Usluga ima zakazane termine") |
| Reorder prvi/zadnji | UI dugmad disabled |
| Active=false na bookable=true | Ne pojavljuje se u `/zakazi` (filter `active AND bookable`) |
| Featured=true | Pojavljuje se na početnoj u "Top 4" sekciji |
