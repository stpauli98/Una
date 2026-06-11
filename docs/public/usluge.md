# `/usluge` — Usluge

**Fajl:** `src/app/usluge/page.tsx`

Katalog svih aktivnih usluga.

## Šta klijent vidi

- Section header "Sve usluge"
- Usluge grupisane po kategoriji:
  - Šminkanje
  - Pedikir
  - Trepavice
  - Obuka
- Svaka kategorija ima `<h3>` header
- Unutar kategorije: grid od `ServiceCard` komponenata (1 col mobile, 2 col tablet, 4 col desktop)
- Svaka kartica ima `<h4>` sa imenom usluge (`headingLevel="h4"` prop)

## ServiceCard

**Fajl:** `src/components/public/ServiceCard.tsx`

**Sadržaj kartice:**
- Ikona kategorije (`✧`, `◈`, `❋`, `◇`)
- Naziv usluge (`<h4>` ako `headingLevel="h4"`)
- Opis (ako postoji)
- Cijena (rose, large)
- Trajanje (light, small)

**Featured kartice:** Ako je usluga `bookable` i `featured=true`, cijela kartica je `<Link>` ka `/zakazi?service={id}` sa hover scale efektom.

## Data fetching

```typescript
const { data: services } = await supabase
  .from("services")
  .select("*")
  .eq("active", true)
  .order("order_index");

const grouped = services.reduce((acc, s) => {
  (acc[s.category] ??= []).push(s);
  return acc;
}, {});
```

## Heading hijerarhija

```
<h1> (implicit) — Usluge šminkanja u Gradišci
  <h2> Sve usluge (SectionHeader)
    <h3> Šminkanje (category)
      <h4> Šminkanje sa trepavicama (ServiceCard)
      <h4> Šminkanje bez trepavica
    <h3> Pedikir
      <h4> Spa pedikir
      ...
```

Konfigurabilan `headingLevel` na `ServiceCard` osigurava SEO-ispravnu hijerarhiju.

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | "Usluge šminkanja u Gradišci" |
| Description | "Sve usluge šminkanja u Gradišci — svadbeno, večernje..." |
| JSON-LD | `ServicesJsonLd` — strukturirani podaci o svim uslugama (ItemList sa Service objektima) |
| Breadcrumb | `BreadcrumbsJsonLd` — Početna > Usluge |

## Edge case-ovi

- Bez `featured` flag-a kartica nije clickable (samo prikazuje info)
- `variable_price=true` prikazuje `price_note` umjesto cifre ("od 80 KM")
- `duration_note` prikazuje umjesto `duration_min` ("upit", "po dogovoru")
- Kategorija bez usluga — sekcija se ne renderuje
