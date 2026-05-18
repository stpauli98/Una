# Animated Hero (Scroll Gallery) — Design

**Status:** Draft (awaiting user review)
**Date:** 2026-05-11
**Author:** Nikola Milošević + Claude Opus 4.7

## Problem

Trenutni `src/components/public/Hero.tsx` koristi jednu portretsku sliku studio-a (`hero-studio.jpg`, 1152×2048) kao full-screen background sa `object-cover`. Na desktop-u (široki landscape) `object-cover` mora extreme croppovati horizontalno — vidi se samo gornji deo slike (plafonjera i zid), bez važnijih elemenata (fotelje, šminkerska oprema). Vlasnica je javila da joj se ne sviđa kako izgleda na desktop-u.

Plus: imamo 7 brand-aligned fotki studio-a u `public/images/hero-section/` koje su sve portretske i sve dobre. Trenutni hero koristi samo jednu — propušten potencijal.

## Goals

- Hero koji izgleda **premium** na desktop-u, prikazuje više fotki studio-a (lookbook estetika tipična za beauty brand-ove).
- Mobile UX ostaje **brz i CTA-prijateljski** — korisnici sa Google-a koji žele rezervaciju ne smiju biti blokirani animacijom.
- Zadržati postojeći brand identitet: Cormorant italic naslov, gold + outline CTAs, eyebrow tekst.
- Poštovati `prefers-reduced-motion` system preference.

## Non-goals

- Video pozadina, parallax, dinamički content u hero-u
- A/B testing dva hero-a u produkciji
- Custom mobile animacija (mobile dobija samo statičnu varijantu)
- Migracija na shadcn/ui kao framework — samo koristimo pattern fajl kao reference

## Architecture

```
src/
├── components/
│   ├── public/
│   │   ├── Hero.tsx                ← wrapper, prati prefers-reduced-motion + viewport
│   │   ├── HeroAnimated.tsx        ← scroll-driven bento (desktop only)
│   │   └── HeroStatic.tsx          ← static fallback (mobile + reduced-motion)
│   └── ui/
│       └── hero-gallery-scroll-animation.tsx  ← Motion primitives (reusable)
└── lib/
    └── images/
        └── hero-images.ts          ← centralizovana lista 5 slika
```

**Razdvajanje odgovornosti:**
- `Hero.tsx` — root wrapper, decideuje koja varijanta se prikazuje, ne sadrži logiku animacije
- `HeroAnimated.tsx` — bento grid + brand tekst, sav scroll-driven UI
- `HeroStatic.tsx` — single foto + tekst + CTAs, zadržava trenutni vizuelni stil
- `hero-gallery-scroll-animation.tsx` — generic Motion library (može se koristiti u drugim sekcijama kasnije)

## Visual composition

### Desktop (animirano)

Scroll container je `min-h-[250vh]` (kraće od originalnog `350vh` template-a) sa **sticky** unutrašnjom sekcijom.

| Scroll % | UI state |
|---|---|
| **0%** | Sticky frame: eyebrow text + Cormorant italic `<h1>Osmijeh je najljepša šminka</h1>` + 2 CTAs centrirani; **5 slika u pozadini sitne** (`scale=0.5`, `translateY=-35%`), gradient overlay tamniji |
| **0→50%** | Tekst i CTAs gase se (`opacity 1→0`, `scale 1→0`); slike rastu i premještaju se na finalne bento pozicije |
| **50→90%** | Tekst nestao, gradient overlay nestaje, **bento grid sa 5 slika** popunjava ekran |
| **>90%** | Sticky se otključa, scroll nastavlja na sledeću sekciju (Services preview) |

**Bento grid (default varijanta):**
- 1. slika: col-span-6 / row-span-3 (velika lijevo)
- 2. slika: col-span-2 / row-span-2 (mala desno gore)
- 3. slika: col-span-2 / row-span-2 (mala desno dole)
- 4. slika: col-span-3 (široka dolje lijevo)
- 5. slika: col-span-3 (široka dolje desno)

### Mobile + reduced-motion (static)

Single full-bleed foto — koristi se **prva slika iz `HERO_IMAGES` niza** (isti list kao animirana verzija) + identičan vizuelan stil kao trenutni hero:
- Eyebrow tekst sa gold linijama
- Cormorant italic naslov
- Description paragraph
- 2 CTAs (gold + outline)
- Dekorativni floating krugovi
- Scroll indicator

## Implementation

### Dependencies (novi)

| Paket | Verzija | Veličina (gzipped) | Razlog |
|---|---|---|---|
| `motion` | `^12` | ~45KB | scroll animacije (zamjenjuje framer-motion) |
| `class-variance-authority` | `^0.7` | ~2KB | bento grid layout variants |

**Ne instaliramo** `@radix-ui/react-slot` ni shadcn Button — pišemo brand-styled `<Link>` direktno.

### Komponentska shema

```tsx
// src/components/ui/hero-gallery-scroll-animation.tsx
"use client";
import { motion, useScroll, useTransform } from "motion/react";

const ContainerScroll = ({ children, className }) => {
  // useScroll target ref, vraća scrollYProgress kroz Context
};
const BentoGrid = ({ variant, ...props }) => {
  // CVA varijante: default | threeCells | fourCells (koristimo default)
};
const BentoCell = ({ children }) => {
  // translateY [-35%, 0%] na [0.1, 0.9], scale [0.5, 1] na [0, 0.9]
};
const ContainerScale = ({ children }) => {
  // opacity [1, 0] + scale [1, 0] na [0, 0.5]; position fixed→absolute na 0.6
};

// src/components/public/Hero.tsx
"use client";
import { useReducedMotion } from "motion/react";
export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(true); // SSR default
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    // listener za resize
  }, []);
  if (prefersReducedMotion || !isDesktop) return <HeroStatic />;
  return <HeroAnimated />;
}
```

### Slike pipeline

5 slika iz `public/images/hero-section/` (UUID-named WebP, 130-243 KB svaka) se učitava kroz `next/image`:

```tsx
<Image
  src={imageUrl}
  alt=""
  aria-hidden
  fill
  priority={index === 0}  // samo prva
  sizes="(min-width:1024px) 50vw, 100vw"
  quality={90}
  className="object-cover"
/>
```

Lista u `src/lib/images/hero-images.ts`:
```ts
export const HERO_IMAGES = [
  "/images/hero-section/13bbdadb-...webp",
  "/images/hero-section/1c3f575a-...webp",
  // ... 5 ukupno
] as const;
```

`quality={90}` koristi `qualities: [75, 90]` config (već u `next.config.ts`).

### Brand theme integration

Komponenta iz template-a koristi shadcn `bg-primary`, `bg-indigo-500`, `text-slate-800` boje — **sve te uklanjamo**. Umjesto njih:
- Background overlay: `bg-gradient-to-b from-dark/70 via-dark/55 to-dark/75` (isto kao trenutni hero)
- Naslov: `font-display text-white drop-shadow-sm` (Cormorant Garamond iz `globals.css`)
- CTAs: `bg-gold` + `border border-white/40 bg-transparent` (isto kao trenutni)

### Bundle-size mitigation

`HeroAnimated` se importuje **dinamički**:
```tsx
const HeroAnimated = dynamic(() => import("./HeroAnimated"), { ssr: false });
```

Mobile korisnici (HeroStatic putanja) ne učitavaju Motion library — ~45KB ušteda.

## Accessibility

| Slučaj | Rješenje |
|---|---|
| Slike su dekoracija | `alt=""` + `aria-hidden` na svim Image-ima |
| Semantičan naslov | `<h1>` u oba (static + animated) |
| Reduced motion | `useReducedMotion()` automatski → static |
| Keyboard focus | Native `<Link>` + `focus-visible:outline-rose` ring |
| Screen reader vs scroll animacija | Tekst ostaje u DOM-u kroz animaciju (samo opacity/scale), ne `display:none` |

## Error handling

| Scenarij | Ponašanje |
|---|---|
| `useReducedMotion()` vraća `null` tokom SSR | Default `false` (animated) → `useEffect` re-render-uje |
| Mobile viewport prepoznato tek na client | Flicker 1 frame — prihvatljivo |
| Slika 404 | `next/image` pokazuje broken img — manuelni QA pri merge-u |
| `motion` chunk fails to load | Fallback nije implementiran — Next dev shows error overlay; u prod-u user vidi prazan hero (rare, CDN ima high uptime) |
| User klikne CTA dok je `opacity: 0.5` | `pointer-events` ostaje aktivan, klik radi |
| Cmd+R u sredini animacije | Scroll resetuje na 0, animacija ponovo počinje |

## Testing

**Unit:** Nema — pretežno UI, bez business logike.

**E2E (Playwright):** `tests/e2e/landing-hero.spec.ts` (3 testa):
1. Mobile viewport (375×667) → static hero renderuje (h1 + jedna img + 2 CTAs)
2. Desktop viewport (1280×720) → animated hero renderuje (h1 + 5 imgs)
3. CTAs imaju ispravne `href` (`/zakazi`, `/usluge`)

**Manuelno (preview-u na Vercel-u):**
- Smooth scroll feel na desktop-u
- Tap "Zakaži termin" na real mobile device-u
- `prefers-reduced-motion: reduce` u Chrome DevTools simulacija

## Out of scope

- Custom mobile animacija (osim system-trigger reduced motion)
- Vidi tek pri scroll: hero pamti scrolled state preko sessions
- A/B testing
- Vlastiti theme variant editor u admin panelu
- Dinamičan `hero-images.ts` (npr. iz baze) — sve hardcoded u kodu

## Rollout

1. PR na novi branch `feature/animated-hero` sa migracijom dependency-ja + komponente + tests
2. Vercel preview deploy → manuelni QA (desktop + mobile real device)
3. Merge u main → produkcija dobija novi hero
4. Rollback plan: `git revert <merge_sha>` (commit za commit revert, postojeći Hero je sačuvan u istoriji)
