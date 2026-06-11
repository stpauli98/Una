# `/cjenovnik` — Cjenovnik

**Fajl:** `src/app/cjenovnik/page.tsx`

Tabelarni prikaz cijena, grupisan po kategorijama.

## Šta klijent vidi

- Section header "Cjenovnik"
- 1 column mobile, 2 col tablet, 3 col desktop (`max-w-[460px]` na mobile, `lg:grid-cols-3`)
- Svaka kartica je kategorija sa listom usluga:

```
┌─────────────────────────┐
│  ŠMINKANJE              │
│ ────────────────────    │
│  Svadbeno          150 KM│
│  Večernje          120 KM│
│  Maturalno         100 KM│
│  Terensko        od 130KM│
└─────────────────────────┘
```

## Layout svake usluge

Flex row sa naziva (lijevo) i cijena (desno):

```tsx
<div className="flex items-center justify-between">
  <span className="flex-1 pr-3 text-[13px]">{service.name}</span>
  <span className="text-[17px] font-display text-rose">{priceDisplay}</span>
</div>
```

`flex-1 pr-3` na nazivu omogućava shrinking; `pr-3` osigurava gap.

## Data fetching

Isto kao `/usluge`:

```typescript
const { data: services } = await supabase
  .from("services")
  .select("*")
  .eq("active", true)
  .order("order_index");
```

## Razlika `/usluge` vs `/cjenovnik`

| | `/usluge` | `/cjenovnik` |
|---|---|---|
| Layout | Kartice sa ikonom + opisom | Lista cijena |
| Klikabilno | Featured kartice → `/zakazi` | Ne |
| Kategorije | Grupisano sa headerima | Grupisano kao kartice |
| Use case | Pregled kataloga | Brzi pogled cijena |

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | "Cjenovnik usluga" |
| Description | "Cijene šminkanja u Gradišci..." |
| Breadcrumb | Početna > Cjenovnik |
