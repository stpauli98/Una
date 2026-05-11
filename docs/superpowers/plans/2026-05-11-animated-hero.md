# Animated Hero (Scroll Gallery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ili superpowers:executing-plans. Steps koriste checkbox (`- [ ]`) sintaksu.

**Goal:** Zamijeniti postojeći full-bleed jednoslikovni Hero scroll-driven bento galerijom sa 5 slika na desktop-u; mobile i `prefers-reduced-motion` users dobijaju static fallback sa istim brand identitetom.

**Architecture:** `Hero.tsx` wrapper detektuje motion preference + viewport, render-uje jednu od dvije podkomponente. `HeroAnimated.tsx` (dinamički importovan, desktop only) koristi Motion v12 scroll primitives iz `hero-gallery-scroll-animation.tsx`. `HeroStatic.tsx` zadržava trenutni vizuelni stil sa boljom fotom. Lista slika centralizovana u `hero-images.ts`.

**Tech Stack:** Next.js 16 App Router (client components), React 19, TypeScript strict, Tailwind v4 (sa custom `@theme` brand tokens), `motion@^12` (Framer Motion v12 rebrand), `class-variance-authority`, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-05-11-animated-hero-design.md`

---

## File Structure

**Created:**
- `src/lib/images/hero-images.ts` — `HERO_IMAGES` readonly array sa 5 path-ova
- `src/components/ui/hero-gallery-scroll-animation.tsx` — `ContainerScroll`, `BentoGrid`, `BentoCell`, `ContainerScale` Motion primitives
- `src/components/public/HeroAnimated.tsx` — desktop scroll-driven hero
- `src/components/public/HeroStatic.tsx` — mobile/reduced-motion fallback hero
- `tests/e2e/landing-hero.spec.ts` — 3 testa (mobile/desktop/CTAs)

**Modified:**
- `src/components/public/Hero.tsx` — postao wrapper koji bira animated/static
- `package.json` + `package-lock.json` — nove dependency-je (`motion`, `class-variance-authority`)

**Read-only reference:**
- `src/lib/utils/cn.ts` — `cn()` helper postoji, koristimo ga u nove komponente
- `src/app/globals.css` — brand tokens (`--color-gold`, `--color-rose`, `--color-dark` itd.) — koristimo Tailwind klase `bg-gold`, `text-dark` koje su povezane
- `next.config.ts` — `qualities: [75, 90]` već postavljen → `quality={90}` na hero slikama je dozvoljen
- `src/components/public/Hero.tsx` (trenutni) — preserve postojeći Cormorant italic naslov, eyebrow tekst, CTAs

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json` + `package-lock.json`

- [ ] **Step 1: Instaliraj motion + cva**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm install motion@^12 class-variance-authority@^0.7
```
Expected: `added 2 packages` (možda + transitive deps). Bez error-a.

- [ ] **Step 2: Verify install**

Run:
```bash
node -e "require('motion'); require('class-variance-authority'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Verify typecheck (sanity check da ne uvodimo type breakage)**

Run: `npm run typecheck`
Expected: pass (bez novih grešaka)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add motion v12 + class-variance-authority

Potrebno za scroll-driven animirani hero (HeroAnimated.tsx). Motion
zamjenjuje framer-motion (rebranded). CVA za bento layout varijante.
"
```

---

## Task 2: Hero images registry

**Files:**
- Create: `src/lib/images/hero-images.ts`

- [ ] **Step 1: Napiši fajl**

```ts
// src/lib/images/hero-images.ts
/**
 * Statična lista slika za hero sekciju (kako desktop animirani, tako
 * static fallback).
 *
 * Redoslijed je VIDLJIV — prva slika je velika u bento layout-u i također
 * jedina slika koju koristi `HeroStatic` mobile/reduced-motion fallback.
 *
 * Fajlovi se učitavaju kroz `next/image` (public asset), `quality={90}`
 * (dozvoljeno kroz `images.qualities` u next.config.ts).
 */
export const HERO_IMAGES = [
  "/images/hero-section/13bbdadb-642b-438c-83a7-170c9aa1c1dd.webp",
  "/images/hero-section/1c3f575a-5fa3-4b47-acef-e9961cb95732.webp",
  "/images/hero-section/41581c1d-d17e-4bbd-8444-8f610b19b588.webp",
  "/images/hero-section/94629d3b-5547-40a1-86bd-48b2703ef221.webp",
  "/images/hero-section/9a44edb0-ce3b-4ac3-8dc5-7b8e9dbc1293.webp",
] as const;

export type HeroImage = (typeof HERO_IMAGES)[number];
```

- [ ] **Step 2: Verifikuj da svi fajlovi postoje**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
for f in /images/hero-section/13bbdadb-642b-438c-83a7-170c9aa1c1dd.webp \
         /images/hero-section/1c3f575a-5fa3-4b47-acef-e9961cb95732.webp \
         /images/hero-section/41581c1d-d17e-4bbd-8444-8f610b19b588.webp \
         /images/hero-section/94629d3b-5547-40a1-86bd-48b2703ef221.webp \
         /images/hero-section/9a44edb0-ce3b-4ac3-8dc5-7b8e9dbc1293.webp; do
  test -f "public$f" && echo "OK: public$f" || echo "MISSING: public$f"
done
```
Expected: 5× `OK`

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/images/hero-images.ts
git commit -m "feat(hero): registry slika za hero sekciju

Centralizovana lista 5 slika koje koristi i animirani i static hero.
Read-only const tuple za type safety."
```

---

## Task 3: Motion primitives (ContainerScroll + BentoGrid)

**Files:**
- Create: `src/components/ui/hero-gallery-scroll-animation.tsx`

- [ ] **Step 1: Napiši komponentu**

```tsx
// src/components/ui/hero-gallery-scroll-animation.tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  HTMLMotionProps,
  MotionValue,
  motion,
  useScroll,
  useTransform,
} from "motion/react";

import { cn } from "@/lib/utils/cn";

const bentoGridVariants = cva(
  "relative grid gap-4 [&>*:first-child]:origin-top-right [&>*:nth-child(3)]:origin-bottom-right [&>*:nth-child(4)]:origin-top-right",
  {
    variants: {
      variant: {
        default: `
          grid-cols-8 grid-rows-[1fr_0.5fr_0.5fr_1fr]
          [&>*:first-child]:col-span-8 md:[&>*:first-child]:col-span-6 [&>*:first-child]:row-span-3
          [&>*:nth-child(2)]:col-span-2 md:[&>*:nth-child(2)]:row-span-2 [&>*:nth-child(2)]:hidden md:[&>*:nth-child(2)]:block
          [&>*:nth-child(3)]:col-span-2 md:[&>*:nth-child(3)]:row-span-2 [&>*:nth-child(3)]:hidden md:[&>*:nth-child(3)]:block
          [&>*:nth-child(4)]:col-span-4 md:[&>*:nth-child(4)]:col-span-3
          [&>*:nth-child(5)]:col-span-4 md:[&>*:nth-child(5)]:col-span-3
        `,
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ContainerScrollContextValue = { scrollYProgress: MotionValue<number> };
const ContainerScrollContext = React.createContext<
  ContainerScrollContextValue | undefined
>(undefined);

function useContainerScrollContext() {
  const ctx = React.useContext(ContainerScrollContext);
  if (!ctx) {
    throw new Error("useContainerScrollContext must be used within ContainerScroll");
  }
  return ctx;
}

export function ContainerScroll({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });
  return (
    <ContainerScrollContext.Provider value={{ scrollYProgress }}>
      <div
        ref={scrollRef}
        className={cn("relative min-h-screen w-full", className)}
        {...props}
      >
        {children}
      </div>
    </ContainerScrollContext.Provider>
  );
}

export const BentoGrid = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof bentoGridVariants>
>(({ variant, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(bentoGridVariants({ variant }), className)}
    {...props}
  />
));
BentoGrid.displayName = "BentoGrid";

export const BentoCell = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, style, ...props }, ref) => {
    const { scrollYProgress } = useContainerScrollContext();
    const translate = useTransform(scrollYProgress, [0.1, 0.9], ["-35%", "0%"]);
    const scale = useTransform(scrollYProgress, [0, 0.9], [0.5, 1]);
    return (
      <motion.div
        ref={ref}
        className={className}
        style={{ translate, scale, ...style }}
        {...props}
      />
    );
  },
);
BentoCell.displayName = "BentoCell";

export const ContainerScale = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, style, ...props }, ref) => {
    const { scrollYProgress } = useContainerScrollContext();
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const position = useTransform(scrollYProgress, (p) =>
      p >= 0.6 ? "absolute" : "fixed",
    );
    return (
      <motion.div
        ref={ref}
        className={cn("left-1/2 top-1/2 size-fit", className)}
        style={{ translate: "-50% -50%", scale, position, opacity, ...style }}
        {...props}
      />
    );
  },
);
ContainerScale.displayName = "ContainerScale";
```

**Bitne razlike od template-a:**
- `cn` import iz `@/lib/utils/cn` (ne `@/lib/utils`)
- Uklonjene `threeCells` i `fourCells` varijante (YAGNI — koristimo samo `default`)

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/hero-gallery-scroll-animation.tsx
git commit -m "feat(ui): scroll-driven Motion primitives (ContainerScroll/BentoGrid/BentoCell/ContainerScale)

Reusable scroll-tied animacije iz template-a, prilagođene za projekt
(cn iz @/lib/utils/cn, uklonjeno YAGNI varijante)."
```

---

## Task 4: HeroAnimated component

**Files:**
- Create: `src/components/public/HeroAnimated.tsx`

- [ ] **Step 1: Napiši komponentu**

```tsx
// src/components/public/HeroAnimated.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BentoCell,
  BentoGrid,
  ContainerScale,
  ContainerScroll,
} from "@/components/ui/hero-gallery-scroll-animation";
import { HERO_IMAGES } from "@/lib/images/hero-images";

/**
 * Desktop scroll-driven hero. 5 slika u bento layout-u + brand-styled
 * naslov + 2 CTA. Animacija traje 250vh scroll-a (~2.5 ekrana visine).
 *
 * Pokreće se SAMO na desktop viewport-ima bez prefers-reduced-motion —
 * `Hero.tsx` wrapper to detektuje.
 */
export function HeroAnimated() {
  return (
    <ContainerScroll className="h-[250vh]">
      <BentoGrid className="sticky left-0 top-0 z-0 h-screen w-full p-4">
        {HERO_IMAGES.map((src, index) => (
          <BentoCell
            key={src}
            className="relative overflow-hidden rounded-xl shadow-xl"
          >
            <Image
              src={src}
              alt=""
              aria-hidden
              fill
              priority={index === 0}
              sizes="(min-width:1024px) 50vw, 100vw"
              quality={90}
              className="object-cover"
            />
          </BentoCell>
        ))}
      </BentoGrid>

      <ContainerScale className="relative z-10 text-center">
        <div className="mb-7 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-gold-light" />
          <p className="font-display text-[11px] italic uppercase tracking-[0.35em] text-gold-light">
            Beauty Studio · Gradiška
          </p>
          <div className="h-px w-8 bg-gold-light" />
        </div>

        <h1 className="mb-5 font-display text-[36px] font-normal leading-[1.08] tracking-wide text-white drop-shadow-lg sm:text-[44px] md:text-[64px] lg:text-[80px]">
          Osmijeh je
          <br />
          <em className="italic font-light">najljepša</em> šminka
        </h1>

        <p className="mx-auto mb-8 max-w-[320px] text-[13px] leading-relaxed tracking-wide text-white drop-shadow-md md:max-w-[440px] md:text-[15px]">
          Profesionalno šminkanje, pedikir i njega trepavica. Vaša prirodna
          ljepota, naglašena sa stilom.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
          <Link
            href="/zakazi"
            className="bg-gold px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#A17E47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          >
            Zakaži termin
          </Link>
          <Link
            href="/usluge"
            className="border border-white/40 bg-transparent px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          >
            Pogledaj usluge
          </Link>
        </div>
      </ContainerScale>
    </ContainerScroll>
  );
}
```

**Bitno:**
- Tekst koristi `drop-shadow-lg`/`drop-shadow-md` za čitljivost preko mješanih background-a slika (bento grid je bez gradient overlay-a)
- `priority={index === 0}` — samo prva slika je priority, ostale lazy
- CTAs zadržavaju isti stil kao trenutni Hero (gold + outline)

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add src/components/public/HeroAnimated.tsx
git commit -m "feat(hero): HeroAnimated — desktop scroll-driven bento gallery

5 slika u bento layout-u, naslov se gasi tokom scroll-a, slike se
sklapaju u finalni grid. h-[250vh] (kraći scroll od originalnog
template-a)."
```

---

## Task 5: HeroStatic component (mobile + reduced-motion fallback)

**Files:**
- Create: `src/components/public/HeroStatic.tsx`

- [ ] **Step 1: Napiši komponentu**

```tsx
// src/components/public/HeroStatic.tsx
import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images/hero-images";

/**
 * Static hero — mobile (< md breakpoint) ili korisnici sa
 * prefers-reduced-motion. Jedan full-bleed foto + gradient overlay +
 * brand-styled naslov + 2 CTA. Isti vizuelan stil kao prethodni Hero
 * (samo bolja foto preko HERO_IMAGES[0]).
 *
 * Renderuje se kao Server Component (default) — nema interaktivnosti.
 */
export function HeroStatic() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pb-16 pt-28">
      <Image
        src={HERO_IMAGES[0]}
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        quality={90}
        className="object-cover object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/55 to-dark/75"
      />

      {/* Dekorativni krugovi (postojeći float animacija u globals.css) */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[8%] size-[280px] rounded-full border border-pink/10"
        style={{ animation: "float 8s ease-in-out infinite" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[10%] left-[-15%] size-[220px] rounded-full border border-gold/10"
        style={{ animation: "float 6s ease-in-out infinite 1s" }}
      />

      <div className="relative z-10 text-center">
        <div className="mb-7 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-gold-light" />
          <p className="font-display text-[11px] italic uppercase tracking-[0.35em] text-gold-light">
            Beauty Studio · Gradiška
          </p>
          <div className="h-px w-8 bg-gold-light" />
        </div>

        <h1 className="mb-5 font-display text-[36px] font-normal leading-[1.08] tracking-wide text-white drop-shadow-sm sm:text-[44px] md:text-[64px] lg:text-[80px]">
          Osmijeh je
          <br />
          <em className="italic font-light">najljepša</em> šminka
        </h1>

        <p className="mx-auto mb-8 max-w-[320px] text-[13px] leading-relaxed tracking-wide text-white/80 md:max-w-[440px] md:text-[15px]">
          Profesionalno šminkanje, pedikir i njega trepavica. Vaša prirodna
          ljepota, naglašena sa stilom.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
          <Link
            href="/zakazi"
            className="bg-gold px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#A17E47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          >
            Zakaži termin
          </Link>
          <Link
            href="/usluge"
            className="border border-white/40 bg-transparent px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          >
            Pogledaj usluge
          </Link>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="h-8 w-px bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add src/components/public/HeroStatic.tsx
git commit -m "feat(hero): HeroStatic — mobile / reduced-motion fallback

Single foto sa gradient overlay-em + isti brand-styled tekst i CTAs kao
trenutni Hero. Foto je HERO_IMAGES[0] (sa ringlight-om i opremom)."
```

---

## Task 6: Hero wrapper — bira animated/static

**Files:**
- Modify: `src/components/public/Hero.tsx` — kompletno zamijeniti (postojeći sadržaj se gubi, ostaje u git history-ji)

- [ ] **Step 1: Zamijeni cijeli Hero.tsx**

```tsx
// src/components/public/Hero.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { HeroStatic } from "./HeroStatic";

/**
 * Wrapper za hero sekciju. Bira jednu od dvije varijante na osnovu:
 * - `prefers-reduced-motion` system preference → static
 * - viewport < md (768px) → static
 * - inače → animated
 *
 * `HeroAnimated` je dinamički importovan da mobile korisnici ne učitavaju
 * Motion v12 bundle (~45KB gzipped).
 */
const HeroAnimated = dynamic(
  () => import("./HeroAnimated").then((m) => ({ default: m.HeroAnimated })),
  { ssr: false, loading: () => <HeroStatic /> },
);

export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (prefersReducedMotion || !isDesktop) {
    return <HeroStatic />;
  }
  return <HeroAnimated />;
}
```

**Bitno:**
- `ssr: false` na HeroAnimated — server renderuje samo HeroStatic. Klijent (desktop) onda zamjenjuje sa HeroAnimated.
- `loading: () => <HeroStatic />` — dok se chunk povlači, prikazuje static (no layout shift).
- SSR default `isDesktop = false` — server vraća HeroStatic uvijek, što je dobro za SEO (text je u DOM-u već pri prvom paint-u).

- [ ] **Step 2: Verify typecheck + build**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm run typecheck && npm run build 2>&1 | tail -15
```
Expected: oba prolaze.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/Hero.tsx
git commit -m "feat(hero): wrapper bira animated/static na osnovu viewport + motion preference

HeroAnimated dynamic import (ssr: false) — mobile ne učitava Motion bundle.
HeroStatic je SSR-rendered da bot dobije text i CTA odmah.
"
```

---

## Task 7: E2E test za novi hero

**Files:**
- Create: `tests/e2e/landing-hero.spec.ts`

- [ ] **Step 1: Napiši testove**

```ts
// tests/e2e/landing-hero.spec.ts
import { test, expect } from "@playwright/test";

test.describe("landing hero", () => {
  test("mobile viewport prikazuje static hero (1 slika + naslov + CTAs)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Naslov je vidljiv
    await expect(
      page.getByRole("heading", { level: 1, name: /Osmijeh je/i }),
    ).toBeVisible();

    // CTAs su vidljivi
    await expect(
      page.getByRole("link", { name: "Zakaži termin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Pogledaj usluge" }),
    ).toBeVisible();

    // Provjeri da je samo 1 hero slika (static) — bento gallery bi imao 5.
    // Tražimo img tag-ove unutar prve <section> elementa stranice.
    const heroImages = page.locator("section").first().locator("img");
    await expect(heroImages).toHaveCount(1);
  });

  test("desktop viewport prikazuje animated hero (5 slika u bento grid-u)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // Naslov je vidljiv
    await expect(
      page.getByRole("heading", { level: 1, name: /Osmijeh je/i }),
    ).toBeVisible();

    // 5 slika u prvoj sekciji (sticky bento grid)
    // HeroAnimated je dynamic, treba sačekati da se hidrata
    await expect(
      page.locator("section").first().locator("img"),
    ).toHaveCount(5, { timeout: 10000 });
  });

  test("CTAs vode na pravu stranicu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // Zakaži termin → /zakazi
    await expect(
      page.getByRole("link", { name: "Zakaži termin" }).first(),
    ).toHaveAttribute("href", /\/zakazi/);

    // Pogledaj usluge → /usluge
    await expect(
      page.getByRole("link", { name: "Pogledaj usluge" }).first(),
    ).toHaveAttribute("href", /\/usluge/);
  });
});
```

- [ ] **Step 2: Pokreni testove**

Predpostavlja dev server na 3001 (postojeći). Ako nije pokrenut, prvo:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm run dev > /tmp/dev.log 2>&1 &
sleep 4  # wait for Ready
```

Onda:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  DOTENV_CONFIG_PATH=.env.local \
  npx playwright test landing-hero --reporter=list
```
Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/landing-hero.spec.ts
git commit -m "test(e2e): landing hero — mobile/desktop varianta + CTAs

3 testa: mobile static (1 slika), desktop animated (5 slika), CTAs vode
na /zakazi i /usluge."
```

---

## Task 8: Push + PR

- [ ] **Step 1: Verify working tree clean**

Run: `git status`
Expected: clean (svi commit-ovi gore završeni).

- [ ] **Step 2: Push branch**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
git push -u origin feature/animated-hero
```
Expected: branch pushed.

- [ ] **Step 3: Otvori PR**

Run:
```bash
gh pr create --base main --head feature/animated-hero \
  --title "feat(hero): animated scroll bento gallery + static fallback" \
  --body "$(cat <<'EOF'
**Spec:** [\`docs/superpowers/specs/2026-05-11-animated-hero-design.md\`](https://github.com/stpauli98/Una/blob/feature/animated-hero/docs/superpowers/specs/2026-05-11-animated-hero-design.md)
**Plan:** [\`docs/superpowers/plans/2026-05-11-animated-hero.md\`](https://github.com/stpauli98/Una/blob/feature/animated-hero/docs/superpowers/plans/2026-05-11-animated-hero.md)

## Summary

- Desktop: scroll-driven bento sa 5 slika (Motion v12), 250vh container, naslov se gasi tokom scroll-a
- Mobile + \`prefers-reduced-motion\`: static fallback (1 slika + brand tekst + CTAs), isti vizuelan stil kao prethodni Hero
- Dinamički import \`HeroAnimated\` — mobile ne učitava Motion bundle (~45KB ušteda)
- Centralizovana lista slika u \`src/lib/images/hero-images.ts\`

## Test plan

- [x] Typecheck + build pass
- [x] E2E: 3/3 (\`npm run test:e2e:local -- landing-hero\`)
- [ ] Vercel preview build
- [ ] Manuelni: desktop scroll feel + mobile real device
- [ ] Manuelni: \`prefers-reduced-motion: reduce\` u DevTools

## Out of scope

- A/B testing
- Custom mobile animacija (mobile = uvijek static)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL je vraćen.

- [ ] **Step 4: Pratiti CI**

Vercel preview build (~2 min) + CodeRabbit review. Korisnik manuelno verifikuje preview URL.

---

## Spec Coverage Self-Review

| Spec sekcija | Task |
|---|---|
| Architecture (Hero / HeroAnimated / HeroStatic / motion primitives) | Task 3-6 |
| Dependencies (motion + cva) | Task 1 |
| HERO_IMAGES centralizovana lista | Task 2 |
| Desktop scroll faze (0/50/90/100%) | Task 4 (Motion primitives + HeroAnimated) |
| Mobile static fallback | Task 5 |
| `useReducedMotion()` integracija | Task 6 |
| Dynamic import HeroAnimated | Task 6 |
| Brand theme (gold, rose, Cormorant italic) | Task 4 + Task 5 (oba zadržavaju brand) |
| 5 slika u bento + slika sa `priority` na prvoj | Task 4 (Step 1, `priority={index === 0}`) |
| Accessibility (alt="", aria-hidden, h1, focus rings) | Task 4 + Task 5 |
| E2E (mobile/desktop/CTAs) | Task 7 |
| Push + PR | Task 8 |

Sve sekcije pokrivene. Tip konzistentnost provjerena (HERO_IMAGES tuple svuda, isti CTAs između animated/static, `quality={90}` konzistentno).

**Placeholder scan:** nema TBD/TODO. Sva code blokovi imaju stvarni kod, ne `// ...`. Sve komande imaju Expected output.
