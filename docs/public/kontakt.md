# `/kontakt` — Kontakt

**Fajl:** `src/app/kontakt/page.tsx`

Sve kontakt informacije + Google Maps embed.

## Šta klijent vidi

### Kontakt kartice (grid)

5 kartica na desktop-u (`lg:grid-cols-5`), 2 col tablet, 1 col mobile (`max-w-[360px]`):

| Kartica | Sadržaj | Akcija |
|---------|---------|--------|
| Telefon | `+387 65 810 323` | `tel:` link |
| WhatsApp | Direkno chat | `wa.me/38765810323` |
| Email | `peranovicuna6@gmail.com` | `mailto:` link |
| Instagram | `@_upmakeup._` | Otvara Instagram |
| TikTok | `@upmakeup21` | Otvara TikTok |

Svaka kartica je `<a>` tag sa `p-5` padding (touch target).

### Adresa

`Majora Milana Tepića 13, Gradiška`

### Google Maps embed

`<iframe>` sa Google Maps URL-om Une lokacije:

```tsx
<iframe
  src="https://www.google.com/maps/embed?..."
  width="100%"
  height="380"
  style={{ border: 0 }}
  allowFullScreen
  loading="lazy"
  referrerPolicy="no-referrer-when-downgrade"
/>
```

Centroid: `45.1492, 17.2599` (Gradiška).

### Google Business Profile link

Footer/CTA "Pogledaj na Google Maps" → otvara GBP profile direktno.

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | "Kontakt — Gradiška" |
| Description | "Kontakt podaci UP Makeup — Majora Milana Tepića 13..." |
| JSON-LD | `BreadcrumbsJsonLd`, `LocalBusinessJsonLd` (na početnoj, ne ovdje) |

## Performanse

- `iframe loading="lazy"` — Google Maps se učita tek kad scroll-uje do njega
- Touch targets ≥44px (svi linkovi)
