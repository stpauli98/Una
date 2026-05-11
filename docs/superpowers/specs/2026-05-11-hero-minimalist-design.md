# Hero Minimalist (Varijanta B) — Design

**Status:** Approved (in auto-mode, korisnica B opcija + tekst kompozicija B)
**Date:** 2026-05-11
**Author:** Nikola Milošević + Claude Opus 4.7

## Problem

Korisnica (Una) procjenjuje koju hero varijantu želi za UP Beauty landing. **Varijanta A** (`feature/animated-hero` / PR #13) je scroll-driven bento gallery sa 5 studio fotki + brand naslov. Korisnica želi i **alternativnu varijantu B** koja je vrlo drugačija da bi mogla porediti i izabrati.

Iz vanjskog prompt-a stigao je `minimalist-hero.tsx` template — editorial minimalist layout sa centralnim portret-ima + dekorativnim krugom + 3-stupca tekstom. Treba ga **adaptirati za UP Beauty brand**.

## Goals

- Vrlo drugačiji vizuelan utisak od A (statičan minimalist umjesto dynamic gallery)
- Stavlja Unu kao osobu/vlasnicu u fokus (Una portret + UP karta)
- Zadržava brand identitet kroz boju (rose) i typography (Cormorant)
- Mobile responzivno (3-stupca → vertical stack)
- Konverzija očuvana: postoji **Zakaži termin** CTA + sekundarni "Saznaj više" link

## Non-goals

- Scroll-driven animacije (to je A varijanta)
- Multiple slika (samo Una portret)
- Zamijeniti A za uvijek — B je alternativa za korisničku procjenu
- Custom Header (koristi se postojeća `Nav` komponenta)

## Architecture

```
src/
├── components/
│   ├── public/
│   │   ├── HeroMinimalist.tsx    ← NEW: B varijanta sa adapted template
│   │   └── Hero.tsx               ← MODIFY: wrapper koristi HeroMinimalist
│   └── (Hero A komponente ostaju u ovom branch-u za buduće reuse ako se odabere A)
```

Hero wrapper u B branch-u **NE koristi useReducedMotion ni viewport detection** — `HeroMinimalist` ima isti minimalist osjećaj na svim viewport-ima (template već ima mobile/desktop responsiveness ugrađen). Mobile = vertical stack.

**Postojeća `Nav` komponenta sa `overHero={true}` ostaje** iznad hero-a kao u trenutnoj kompoziciji (`page.tsx`).

## Visual composition

### Desktop (md+ breakpoint)

3-stupca grid layout unutar `h-screen` container-a:

| Lijevo (1/3) | Centar (1/3) | Desno (1/3) |
|---|---|---|
| Paragraf opisa<br>Saznaj više link<br>Zakaži termin CTA | Rose krug (h-[400px])<br>Una portret (z-10) preko | "**manje je**"<br>"**više.**"<br>(text-7xl/9xl, font-extrabold) |

Footer info unutar hero-a (apsolutno na dnu, isti `max-w-7xl`):
- Lijevo: Instagram + TikTok social ikone
- Desno: "Gradiška, BiH"

### Mobile (< md)

Vertical stack:
1. Una portret + rose krug (red 1, h-[300px])
2. Paragraf opisa centrirani (red 2)
3. Saznaj više link (red 3)
4. Zakaži termin CTA (red 4)
5. "manje je više." velik tekst (red 5)
6. Social + lokacija (red 6)

### Brand color adaptacija

| Template (shadcn) | UP Beauty brand |
|---|---|
| `bg-yellow-400/90` | `bg-rose/90` (`#c4787a`) |
| `bg-background` | `bg-marble` (`#fdfbf9`) |
| `text-foreground` | `text-dark` (`#3d2b2b`) |
| `text-foreground/60` | `text-light` (`#887070`) |
| `text-foreground/80` | `text-body` (`#5a4545`) |

## Implementation

### Komponentska shema

```tsx
// src/components/public/HeroMinimalist.tsx
"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Instagram } from "lucide-react";
import { BUSINESS } from "@/lib/constants/business";

const TIKTOK_ICON_SVG = ...; // inline SVG jer lucide-react nema TikTok

export function HeroMinimalist() {
  return (
    <section className="relative flex h-screen w-full flex-col items-center justify-between overflow-hidden bg-marble p-6 pt-28 md:p-12 md:pt-32">
      {/* Main grid */}
      <div className="relative grid w-full max-w-7xl flex-grow grid-cols-1 items-center gap-8 md:grid-cols-3">
        {/* Lijevo: opis + linkovi + CTA */}
        <motion.div className="z-20 order-2 md:order-1 text-center md:text-left" ...>
          <p className="mx-auto max-w-xs font-display italic text-sm text-body md:mx-0 md:text-base">
            Profesionalno šminkanje, pedikir i njega trepavica. Vaša prirodna ljepota, naglašena sa stilom.
          </p>
          <Link href="/o-meni" className="mt-4 inline-block text-sm font-medium text-dark underline">
            Saznaj više →
          </Link>
          <div className="mt-6">
            <Link href="/zakazi" className="inline-block bg-gold px-7 py-3 text-[11px] uppercase tracking-[0.25em] text-white hover:bg-[#A17E47]">
              Zakaži termin
            </Link>
          </div>
        </motion.div>

        {/* Centar: krug + portret */}
        <div className="relative order-1 md:order-2 flex justify-center items-center h-full">
          <motion.div
            className="absolute z-0 h-[300px] w-[300px] rounded-full bg-rose/90 md:h-[400px] md:w-[400px] lg:h-[500px] lg:w-[500px]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
            className="relative z-10"
          >
            <Image src="/images/unaHero.png" alt="Una Peranović" width={290} height={400} priority className="object-contain" />
          </motion.div>
        </div>

        {/* Desno: minimalist slogan */}
        <motion.div className="z-20 order-3 flex items-center justify-center text-center md:justify-start" ...>
          <h1 className="font-display text-7xl font-extrabold leading-[0.95] text-dark md:text-8xl lg:text-9xl">
            manje je
            <br />
            <em className="italic font-normal">više.</em>
          </h1>
        </motion.div>
      </div>

      {/* Footer info */}
      <footer className="z-30 flex w-full max-w-7xl items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <a href={BUSINESS.instagram} ...><Instagram className="h-5 w-5 text-light hover:text-rose" /></a>
          <a href={BUSINESS.tiktok} ...>{/* inline TikTok SVG */}</a>
        </div>
        <div className="text-body">Gradiška, BiH</div>
      </footer>
    </section>
  );
}
```

### Hero wrapper (privremena izmjena za B branch)

```tsx
// src/components/public/Hero.tsx (na B branch-u)
import { HeroMinimalist } from "./HeroMinimalist";

export function Hero() {
  return <HeroMinimalist />;
}
```

Wrapper-ova logika sa `useReducedMotion` + viewport detection nije potrebna jer HeroMinimalist ima jednu varijantu koja se responzivno menja kroz Tailwind klase.

### Dependencies

**Već instalirani u A branch-u (i u B sa main-a):**
- `motion@^12` — entrance animacije
- `lucide-react` — Instagram ikona

**Custom inline SVG:** TikTok (jer lucide-react nema TikTok built-in)

### Accessibility

- `<section>` semantic wrapper
- `<h1>` jedan po stranici ("manje je više.")
- `alt="Una Peranović"` opis za screen reader (nije dekorativna, predstavlja vlasnicu)
- Krug ima `aria-hidden` (dekorativan)
- Social linkovi imaju `target="_blank" rel="noopener noreferrer"`
- Focus rings (`focus-visible:outline-rose`) na svim interaktivnim elementima
- `prefers-reduced-motion` — Motion library automatski poštuje system preference (entrance animacije se preskaču ako je `reduce`)

### Error handling

| Slučaj | Ponašanje |
|---|---|
| `unaHero.png` ne postoji | next/image vraća 404 broken image — manuelni QA pri merge-u (slika je već u public/) |
| `BUSINESS.instagram` falsy | Link `href=""` neispravan — `BUSINESS` je tipovno provjeren u kompajl-u |
| Mobile portrait orientacija → tekst overflow | Test sa real device pre merge-a (`text-7xl` na 320px width je granica) |

## Testing

**Unit:** Nema — pure UI.

**E2E (Playwright):** `tests/e2e/landing-hero-minimalist.spec.ts`
1. Hero renderuje naslov "manje je više"
2. Una slika je tu (`unaHero.png` u src ili srcset)
3. CTAs vode na `/zakazi` i `/o-meni`

**Manuelno:**
- Desktop 1440px + 1920px: layout balansiran, krug ne pokriva tekst desno
- Mobile 375×667: vertical stack čitljiv
- `prefers-reduced-motion: reduce`: nema entrance animacije

## Rollout

1. **Novi branch** `feature/hero-minimalist-b` sa main-a (ne nasljeđuje A branch)
2. PR #14 ka main
3. Korisnica testira oba Vercel preview-a:
   - PR #13 (A): scroll-driven bento gallery
   - PR #14 (B): minimalist editorial
4. Korisnica mergeuje jedan, zatvara drugi
5. Backup plan: ako želi oba u kasnijoj fazi, može se dodati admin toggle u settings (out-of-scope za sad)

## Out of scope

- Admin toggle A/B u settings
- A/B testing kroz feature flag (Vercel rollout)
- Drugačija slika za mobile (koristi se ista `unaHero.png` na svim viewport-ima)
- Više slika u rotaciji (B je single-image hero)
