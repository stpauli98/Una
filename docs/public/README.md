# Javni sajt — pregled

Sve stranice koje vidi korisnik bez logovanja.

## Lista stranica

| URL | Fajl | Tip |
|-----|------|-----|
| `/` | `src/app/page.tsx` | ISR (300s) |
| `/usluge` | `src/app/usluge/page.tsx` | ISR (300s) |
| `/cjenovnik` | `src/app/cjenovnik/page.tsx` | ISR (300s) |
| `/galerija` | `src/app/galerija/page.tsx` | ISR (300s) |
| `/o-meni` | `src/app/o-meni/page.tsx` | Statična |
| `/kontakt` | `src/app/kontakt/page.tsx` | Statična |
| `/obuka` | `src/app/obuka/page.tsx` | Statična |
| `/zakazi` | `src/app/zakazi/page.tsx` | ISR (300s) |
| `/zakazi/uspjesno` | `src/app/zakazi/uspjesno/page.tsx` | Dynamic (noindex) |
| `/politika-privatnosti` | `src/app/politika-privatnosti/page.tsx` | Statična |
| `/uslovi-koriscenja` | `src/app/uslovi-koriscenja/page.tsx` | Statična |
| `/~offline` | `src/app/~offline/page.tsx` | PWA offline fallback |

## Zajedničke komponente

| Komponenta | Fajl | Gdje se koristi |
|-----------|------|-----------------|
| `Nav` | `src/components/public/Nav.tsx` | Sve stranice (top bar) |
| `Footer` | `src/components/public/Footer.tsx` | Sve stranice (bottom) |
| `CookieBanner` | `src/components/public/CookieBanner.tsx` | Root layout (sve stranice) |
| `LocalBusinessJsonLd` | `src/components/public/LocalBusinessJsonLd.tsx` | Početna (SEO) |
| `BreadcrumbsJsonLd` | `src/components/public/BreadcrumbsJsonLd.tsx` | Sve podstranice |
| `SectionHeader` | `src/components/public/SectionHeader.tsx` | Naslovi sekcija |
| `ServiceCard` | `src/components/public/ServiceCard.tsx` | `/usluge` katalog |
| `TestimonialsCarousel` | `src/components/public/TestimonialsCarousel.tsx` | Početna |
| `HeroAnimated` / `HeroStatic` | `src/components/public/Hero*.tsx` | Početna |
| `GalleryGrid` | `src/components/public/GalleryGrid.tsx` | `/galerija` |

## Layout & metadata

Root layout: `src/app/layout.tsx`

**Globalno postavlja:**
- Font (Cormorant Garamond — display, DM Sans — body)
- Meta tags (title, description, OG, Twitter)
- Manifest link
- Theme color
- Viewport
- Apple touch icon
- Cookie banner (uvijek u DOM-u)

**Per-page metadata:** Svaka stranica exportuje `metadata: Metadata`:

```typescript
export const metadata: Metadata = {
  title: "Naslov stranice",
  description: "Opis za SEO",
  alternates: { canonical: "/path" },
  openGraph: { url: "/path" },
};
```

## SEO strategija

Sve stranice imaju:

| Element | Lokacija | Šta sadrži |
|---------|----------|------------|
| `<title>` | Per-page metadata | "Naslov · UP Makeup" |
| `<meta description>` | Per-page metadata | Srpski opis sa keywordovima |
| Canonical URL | `alternates.canonical` | Sprjecava duplicate content |
| OG image | `/opengraph-image` (dinamička) | 1200×630 brand image |
| JSON-LD | `BreadcrumbsJsonLd`, `LocalBusinessJsonLd` | Strukturirani podaci |
| Sitemap entry | `src/app/sitemap.ts` | Sve javne rute sa priority + frequency |

## Stilovi

Sve preko Tailwind v4 sa `@theme` u `src/app/globals.css`:

```css
@theme {
  --color-rose: #c4787a;
  --color-dark: #3d2b2b;
  --color-cream: #f0e6dd;
  --color-marble: #fdfbf9;
  --color-light: #887070;
  --color-gold: #b8965a;
}
```

Klase: `bg-rose`, `text-dark`, `border-cream`, itd.

## Brand identitet

| Element | Vrijednost |
|---------|-----------|
| Logo (tekst) | "UP" + "Makeup" (split, font-display) |
| Brand boja | Rose `#c4787a` |
| Akcent | Gold `#b8965a` (za "Zakaži termin" CTA) |
| Background | Marble `#fdfbf9` |
| Body tekst | `#5a4545` (WCAG AA contrast) |
| Display font | Cormorant Garamond (serif, elegantan) |
| Body font | DM Sans (sans, čitljiv) |
| Tagline (OG) | "Osmijeh je najljepša šminka" |

## Responsive breakpoints

Iz Tailwind default-a:

| Breakpoint | Min width | Use case |
|------------|-----------|----------|
| (default) | 0px | Mobile-first design |
| `sm` | 640px | Veliki mobilni / mali tablet |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Veliki desktop |

Mobile prvo — sve stranice testirane na 375px (iPhone SE).

## Accessibility (a11y)

| Element | Implementacija |
|---------|----------------|
| Kontrast | WCAG AA (4.5:1 za tekst) |
| Focus rings | `focus-visible:outline-2 focus-visible:outline-rose` na svim inputima |
| Touch targets | Min 44×44px (svi linkovi/dugmad) |
| Lightbox focus trap | Custom hook (gallery) |
| Mobile nav focus trap | `inert` na main/footer kad je meni otvoren |
| `prefers-reduced-motion` | Testimonials carousel respektuje |
| Alt text | Sve slike imaju (galerija iz baze, ostale hardcoded) |
| ARIA labels | Svi interactive elementi |

## Sledeće

Pogledaj pojedinačne stranice:
- [pocetna.md](./pocetna.md) — Landing
- [zakazi.md](./zakazi.md) — Booking flow (najkompleksnije)
- [galerija.md](./galerija.md) — Lightbox + swipe
- ostale...
