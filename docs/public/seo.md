# SEO infrastruktura

Tehnički SEO sloj — sitemap, robots, JSON-LD strukturirani podaci, OG image, ikone.

## Sitemap — `src/app/sitemap.ts`

Next.js metadata konvencija — automatski servira `/sitemap.xml`. 10 javnih ruta sa prioritetima:

| Ruta | changeFrequency | priority |
|------|-----------------|----------|
| `/` | weekly | 1.0 |
| `/usluge`, `/cjenovnik` | monthly | 0.9 |
| `/zakazi` | daily | 0.9 |
| `/galerija` | weekly | 0.8 |
| `/kontakt` | yearly | 0.8 |
| `/o-meni` | yearly | 0.7 |
| `/obuka` | monthly | 0.7 |
| `/politika-privatnosti`, `/uslovi-koriscenja` | yearly | 0.3 |

Base URL iz `NEXT_PUBLIC_SITE_URL`. Admin/API rute namjerno NISU u sitemap-u.

## Robots — `src/app/robots.ts`

Servira `/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /admin/, /api/, /zakazi/uspjesno
Sitemap: https://upmakeup.ba/sitemap.xml
```

`/zakazi/uspjesno` je blokiran jer sadrži confirmation token u URL-u — ne smije završiti u Google indeksu.

## JSON-LD strukturirani podaci

Tri tipa, sve server-rendered `<script type="application/ld+json">`:

| Komponenta | Schema.org tip | Gdje se renderuje |
|-----------|----------------|--------------------|
| `LocalBusinessJsonLd` | `BeautySalon` (LocalBusiness) | Sve javne stranice (layout) — ime, adresa Gradiška, telefon, radno vrijeme, geo |
| `ServicesJsonLd` | `ItemList` + `Service` | `/usluge`, `/cjenovnik` — katalog usluga sa cijenama (builder: `src/lib/seo/services-jsonld.ts`) |
| `BreadcrumbsJsonLd` | `BreadcrumbList` | Sve podstranice (builder: `src/lib/seo/breadcrumbs-jsonld.ts`) |

NAP konzistencija (Name/Address/Phone) sa Google Business profilom "UP Makeup" — bitno za lokalni SEO ranking u Gradišci.

Unit testovi: `tests/unit/services-jsonld.test.ts` (19), `tests/unit/breadcrumbs-jsonld.test.ts` (8).

## Metadata + title template

Root layout (`src/app/layout.tsx`):

```typescript
title: {
  template: `%s · ${BUSINESS.name}`,   // "Galerija · UP Makeup"
  default: "UP Makeup ...",
}
```

Svaka stranica postavlja samo svoj dio (`title: "Galerija"`), template dodaje brand sufiks.

## OG image — `src/app/opengraph-image.tsx`

Dinamički generisana 1200×630 PNG slika (Next.js ImageResponse) — prikazuje se kad neko share-uje link na WhatsApp/Viber/Facebook. Alt: "UP Makeup — Gradiška".

## Ikone

| Fajl | Šta generiše |
|------|--------------|
| `src/app/icon.tsx` + `icon1.tsx` | Favicon varijante (ImageResponse) |
| `public/` PWA ikone | Manifest ikone (vidi [pwa.md](./pwa.md)) |

## Error stranice

- `src/app/not-found.tsx` — custom 404 (brand styling, link nazad)
- `src/app/error.tsx` — runtime error boundary

## Google Search Console

Verifikacioni fajl: `public/google67297b75402cc7b3.html` (HTML file metoda). Nakon DNS propagacije `upmakeup.ba` → submit sitemap u Search Console.

## E2E testovi

`tests/e2e/seo.spec.ts` + `tests/e2e/seo-round-2.spec.ts` — provjeravaju canonical URL-ove, meta tagove, JSON-LD prisustvo, H1 strukturu, alt atribute galerije.

## Sledeće

- [README.md](./README.md) — pregled javnog sajta
- [pwa.md](./pwa.md) — manifest i ikone
