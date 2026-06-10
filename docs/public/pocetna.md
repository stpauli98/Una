# `/` — Početna

**Fajl:** `src/app/page.tsx`

Landing page. Prvi utisak za sve klijente.

## Sekcije

### 1. Hero (animated ili statični)

**Fajlovi:**
- `src/components/public/HeroAnimated.tsx` — desktop, sa scroll animacijama
- `src/components/public/HeroStatic.tsx` — mobile, static fallback

**Sadržaj:**
- Hero slike (gallery scroll efekat na desktop-u)
- Eyebrow tekst: "Beauty Studio · Gradiška"
- H1: "Osmijeh je / najljepša šminka" (ili slično)
- 2 CTA: "Zakaži termin" (rose) + "Pogledaj galeriju" (outline)

Slike: `src/lib/images/hero-images.ts` lista referenci na Supabase Storage.

### 2. Services preview

Top 4 usluge (po `order_index`), 4-column grid.

Server fetch:
```typescript
const { data: topServices } = await supabase
  .from("services")
  .select("*")
  .eq("featured", true)
  .order("order_index")
  .limit(4);
```

Komponenta: `ServiceCard` (`src/components/public/ServiceCard.tsx`).

### 3. About preview

Kratak text + slika Une + CTA "Pročitaj više" → `/o-meni`.

### 4. Testimonials carousel

**Komponenta:** `src/components/public/TestimonialsCarousel.tsx`

- Static array citata (ne iz baze)
- Auto-rotacija svake 4.5 sekunde
- Pauza kad korisnik klikne dot
- Respects `prefers-reduced-motion`

### 5. CTA na booking

Velika sekcija sa "Zakaži svoj termin" + dugme.

### 6. Cookie banner

Globalno iz layout-a, vidi [cookie-banner.md](./cookie-banner.md).

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | `Šminkanje Gradiška — UP Makeup` |
| Description | "Profesionalno šminkanje u Gradišci..." |
| OG image | `/opengraph-image` (1200×630) |
| JSON-LD | `LocalBusinessJsonLd` sa adresom, geo, sat ima, social |

## Performanse

- Above-the-fold slike: `priority` prop
- Below-the-fold: lazy
- Statična generacija + ISR 300s
