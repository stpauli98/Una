# `/galerija` — Galerija

Slike radova sa fullscreen lightbox-om i mobile swipe navigacijom.

## Fajlovi

| Fajl | Šta radi |
|------|----------|
| `src/app/galerija/page.tsx` | Server komponenta, fetch slika |
| `src/components/public/GalleryGrid.tsx` | Glavna client komponenta — grid + lightbox |

## Šta klijent vidi

**Grid:**
- 2 kolone na mobilnom (`grid-cols-2`)
- 3 kolone na tabletu (`md:grid-cols-3`)
- 4 kolone na desktop-u (`lg:grid-cols-4`)
- Aspect ratio 1:1 (kvadrati)
- Loading skeleton (`animate-pulse` na `bg-cream`)

**Filteri** (chip-style dugmad iznad grida):
- Sve
- Šminkanje
- Svadbeno
- Pedikir
- Trepavice

Klik na sliku → otvori fullscreen lightbox.

## Data fetching (server-side)

```typescript
const { data: images } = await supabase
  .from("gallery_images")
  .select("id, storage_path, category, alt_text")
  .order("order_index");
```

URL slike se gradi kroz Supabase Storage public URL:

```typescript
const url = `${SUPABASE_URL}/storage/v1/object/public/gallery/${img.storage_path}`;
```

## Performanse

| Optimizacija | Implementacija |
|-------------|----------------|
| **Priority loading** | Prvih 8 slika imaju `priority={index < 8}` |
| **Lazy loading** | Ostatak default `loading="lazy"` |
| **AVIF/WebP** | `next.config.ts` `formats: ["image/avif", "image/webp"]` |
| **Responsive sizes** | `sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"` |
| **CDN cache** | 30 dana (`minimumCacheTTL: 2592000`) |
| **Skeleton on error** | `onError` handler ukloni `animate-pulse` |
| **Skeleton on load** | `onLoad` handler ukloni `animate-pulse` |

## Lightbox

**Trigger:** Klik (ili Enter na keyboard fokusu) na bilo koju thumbnail.

### Render

Lightbox se render-uje kroz **`createPortal(lightbox, document.body)`** — izlazi iz React tree-a u `<body>`.

**Razlog:** Mobile nav koristi `inert` atribut na `<main>` za focus trap. Bez portala, lightbox bi se nalazio unutar `<main>` i postao bi i sam `inert` (3 klika za zatvaranje bug).

### Top bar

- Counter (lijevo): `1 / 55`
- X dugme (desno): `size-11` rounded, `bg-white/10`

### Slika

- `max-h-[calc(100vh-8rem)]` — 100% visine minus top bar i padding
- `max-w-full` — 100% širine
- `object-contain` — proporcije sačuvane
- `pointer-events-auto` na slici, `pointer-events-none` na wrapper-u

### Desktop strelice

- Lijevo / desno — pojavljuju se samo `md:flex` (sakrivene na mobilnom)
- `absolute top-1/2 -translate-y-1/2` centriranje
- Klik prebaci na prethodnu/sljedeću sliku

### Mobile swipe

Custom touch handler:

```typescript
let touchStartX = 0;
let touchStartY = 0;

const handleTouchStart = (e: TouchEvent) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
};

const handleTouchEnd = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  // Threshold 50px + dx > dy (sprečava vertikalni scroll triggers)
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) goNext();
    else goPrev();
  }
};
```

**Threshold 50px** sprjecava slučajne swipe-ove.
**`Math.abs(dx) > Math.abs(dy)` guard** sprjecava da vertikalni scroll triggeruje navigaciju.

### Keyboard navigacija

| Tipka | Radnja |
|-------|--------|
| `Escape` | Zatvori |
| `ArrowRight` | Sljedeća |
| `ArrowLeft` | Prethodna |
| `Tab` | Stays unutar lightbox (focus trap) |

### Focus trap

Kad se lightbox otvori:
1. `triggerRef.current = document.activeElement` — pamti šta je bio fokus prije
2. `main?.setAttribute("inert", "")` — sve ispod lightbox-a postaje non-interactive
3. `closeRef.current?.focus()` — auto-fokus na X dugme

Kad se zatvori:
1. `main?.removeAttribute("inert")`
2. `triggerRef.current?.focus()` — vrati fokus na thumbnail koji je otvorio

### Body scroll lock

```typescript
document.body.style.overflow = "hidden";
// cleanup u return:
document.body.style.overflow = "";
```

Klijent ne može skrolovati pozadinu dok je lightbox otvoren.

## Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Galerija prazna | Empty state sa Instagram linkom |
| Slika ne učita | `onError` ukloni skeleton, prikazuje broken image |
| Brzi swipe | Threshold 50px filtrira slučajne pokrete |
| Vertikalni swipe | Ne trigger-uje navigaciju (dy > dx guard) |
| Klik na backdrop | Zatvara lightbox |
| Klik na sliku | Ne zatvara (event.stopPropagation na image wrapper) |
| Klik na X | Zatvara |
| Klik na strelicu | `e.stopPropagation()` da ne zatvori backdrop |

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | "Galerija · UP Makeup" (page postavlja "Galerija", layout template dodaje " · UP Makeup") |
| Description | "Portfolio radova UP Makeup..." |
| Alt text | Iz `gallery_images.alt_text` (default fallback: "UP Makeup — {category}") |
| Canonical | `/galerija` |

## Sledeće

- [admin/galerija.md](../admin/galerija.md) — upload + management
- [security/file-upload.md](../security/file-upload.md) — validacija upload-a
