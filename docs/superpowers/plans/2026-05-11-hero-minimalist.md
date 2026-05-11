# Hero Minimalist (Varijanta B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ili superpowers:executing-plans. Steps koriste checkbox (`- [ ]`) sintaksu.

**Goal:** Implementirati editorial minimalist hero sa Una portretom + rose krug + "manje je / više." slogan kao alternativu A varijanti (PR #13), da korisnica može da bira između dva pristupa.

**Architecture:** Jedna nova komponenta `HeroMinimalist.tsx` koja zamjenjuje postojeću Hero komponentu na ovoj branch-i. Koristi `motion@^12` (već instaliran ako se merge sa A; treba ručno instalirati ovde jer smo branch-irani sa main-a koji nema A promjene). Postojeći Nav komponent ostaje iznad sa `overHero={true}`.

**Tech Stack:** Next.js 16 (client component), Motion v12 za entrance animacije, Tailwind v4 (brand `@theme` tokens), lucide-react za Instagram ikonu, postojeća `BUSINESS` konstanta za social linkove.

**Spec:** `docs/superpowers/specs/2026-05-11-hero-minimalist-design.md`

---

## File Structure

**Created:**
- `src/components/public/HeroMinimalist.tsx` (~120 linija)
- `tests/e2e/landing-hero-minimalist.spec.ts` (~50 linija)

**Modified:**
- `src/components/public/Hero.tsx` — privremeno postaje thin wrapper koji renderuje samo `HeroMinimalist`
- `package.json` + `package-lock.json` — `motion@^12` + `class-variance-authority@^0.7` (CVA nije strogo potreban za B, ali instaliramo za konzistenciju ako se sutra koristi)

**Read-only reference:**
- `src/lib/constants/business.ts` — `BUSINESS.instagram`, `BUSINESS.tiktok` već postoje
- `src/lib/utils/cn.ts` — `cn()` helper
- `src/app/globals.css` — brand tokens (`--color-rose`, `--color-gold`, `--color-marble`, `--color-dark`, `--color-light`, `--color-body`)
- `next.config.ts` — `qualities: [75, 90]`, `remotePatterns` već konfigurisani
- `public/images/unaHero.png` — već postoji (422×591 PNG sa transparent pozadinom)

---

## Task 1: Install motion v12

**Files:**
- Modify: `package.json` + `package-lock.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm install motion@^12
```
Expected: `added X packages` bez error-a.

- [ ] **Step 2: Verify require**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
node -e "require('motion'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
git add package.json package-lock.json
git commit -m "chore(deps): add motion v12 (za HeroMinimalist)

Entrance animacije sa staggered delay-em za minimalist hero (varijanta B).
"
```

---

## Task 2: HeroMinimalist komponenta

**Files:**
- Create: `src/components/public/HeroMinimalist.tsx`

- [ ] **Step 1: Napiši komponentu**

```tsx
// src/components/public/HeroMinimalist.tsx
"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Instagram } from "lucide-react";
import { BUSINESS } from "@/lib/constants/business";

/**
 * Minimalist editorial hero — Una portret centriran ispred rose kruga,
 * 3-stupca tekst layout (opis lijevo, krug centar, slogan desno).
 *
 * Varijanta B koja korisnica može da bira umjesto animated A varijante.
 * Statičan layout sa entrance animacijama (bez scroll-driven complexity).
 */
export function HeroMinimalist() {
  return (
    <section className="relative flex h-screen w-full flex-col items-center justify-between overflow-hidden bg-marble px-6 pb-8 pt-28 md:px-12 md:pb-12 md:pt-32">
      {/* Main 3-column grid */}
      <div className="relative grid w-full max-w-7xl flex-grow grid-cols-1 items-center gap-8 md:grid-cols-3">
        {/* Lijevo: opis + Saznaj više + Zakaži termin CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="z-20 order-2 text-center md:order-1 md:text-left"
        >
          <p className="mx-auto max-w-xs font-display italic text-sm leading-relaxed text-body md:mx-0 md:text-base">
            Profesionalno šminkanje, pedikir i njega trepavica. Vaša prirodna
            ljepota, naglašena sa stilom.
          </p>
          <Link
            href="/o-meni"
            className="mt-4 inline-block text-sm font-medium text-dark underline decoration-rose decoration-2 underline-offset-4 transition-colors hover:text-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          >
            Saznaj više →
          </Link>
          <div className="mt-6">
            <Link
              href="/zakazi"
              className="inline-block bg-gold px-7 py-3 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#A17E47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            >
              Zakaži termin
            </Link>
          </div>
        </motion.div>

        {/* Centar: rose krug + Una portret */}
        <div className="relative order-1 flex h-full items-center justify-center md:order-2">
          <motion.div
            aria-hidden
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="absolute z-0 size-[300px] rounded-full bg-rose/90 md:size-[400px] lg:size-[500px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
            className="relative z-10"
          >
            <Image
              src="/images/unaHero.png"
              alt="Una Peranović"
              width={290}
              height={400}
              priority
              quality={90}
              className="h-auto w-56 object-contain md:w-64 lg:w-72"
            />
          </motion.div>
        </div>

        {/* Desno: minimalist slogan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="z-20 order-3 flex items-center justify-center text-center md:justify-start md:text-left"
        >
          <h1 className="font-display text-6xl font-extrabold leading-[0.95] tracking-tight text-dark sm:text-7xl md:text-8xl lg:text-9xl">
            manje je
            <br />
            <em className="italic font-normal">više.</em>
          </h1>
        </motion.div>
      </div>

      {/* Footer info inside hero */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="z-30 flex w-full max-w-7xl items-center justify-between text-sm"
      >
        <div className="flex items-center space-x-4">
          <a
            href={BUSINESS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-light transition-colors hover:text-rose focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose"
            aria-label="Instagram UP Beauty"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href={BUSINESS.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            className="text-light transition-colors hover:text-rose focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose"
            aria-label="TikTok UP Beauty"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.13Z" />
            </svg>
          </a>
        </div>
        <div className="font-display italic text-body">Gradiška, BiH</div>
      </motion.footer>
    </section>
  );
}
```

**Bitno:**
- Cormorant italic (`font-display italic`) za paragraf — match-uje brand typography
- Slogan "manje je / više." sa `<em>` na "više." daje istu italic emfaze kao u glavnom Hero-u
- Rose krug ima `aria-hidden` (dekorativan), portret ima alt text "Una Peranović" (predstavlja vlasnicu, ne dekoracija)
- Entrance delay-i: krug 0.2s → portret 0.4s → lijevi text 0.8s → desni text 1.0s → footer 1.2s (cinematic stagger)
- `size-[300px]` Tailwind shortcut za `h-[300px] w-[300px]`

- [ ] **Step 2: Verify typecheck**

Run: `cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck`
Expected: pass

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
git add src/components/public/HeroMinimalist.tsx
git commit -m "feat(hero): HeroMinimalist — editorial minimalist B varijanta

Una portret + rose krug + 'manje je / više.' slogan u 3-stupca grid-u.
Brand-adapted iz vanjskog template-a (yellow→rose, shadcn tokens→UP
Beauty boje). Entrance animacije sa staggered delay-em.
"
```

---

## Task 3: Hero wrapper

**Files:**
- Modify: `src/components/public/Hero.tsx` — postaje thin wrapper za `HeroMinimalist`

- [ ] **Step 1: Zamijeni cijeli Hero.tsx**

```tsx
// src/components/public/Hero.tsx
import { HeroMinimalist } from "./HeroMinimalist";

/**
 * Hero sekcija — trenutno renderuje HeroMinimalist (varijanta B).
 *
 * Alternativna A varijanta (scroll-driven bento gallery) je dostupna na
 * branch-u `feature/animated-hero` / PR #13. Korisnica procjenjuje obje
 * varijante i bira koju mergeuje u main.
 */
export function Hero() {
  return <HeroMinimalist />;
}
```

- [ ] **Step 2: Verify typecheck + build**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm run typecheck
npm run build 2>&1 | tail -10
```
Expected: oba prolaze.

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
git add src/components/public/Hero.tsx
git commit -m "feat(hero): wrapper renderuje HeroMinimalist (B varijanta)

Stari single-image Hero (sa hero-studio.jpg) ostaje u git history.
Korisnica može da uporedi sa A varijantom (PR #13) i izabere.
"
```

---

## Task 4: E2E test

**Files:**
- Create: `tests/e2e/landing-hero-minimalist.spec.ts`

- [ ] **Step 1: Napiši test**

```ts
import { test, expect } from "@playwright/test";

test.describe("landing hero minimalist (varijanta B)", () => {
  test("renderuje 'manje je više' slogan + Una portret", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Slogan je <h1> sa 'manje je / više.'
    await expect(
      page.getByRole("heading", { level: 1, name: /manje je\s+više/i }),
    ).toBeVisible();

    // Una portret je tu — provjeravamo src kroz srcset (unaHero.png)
    await expect(
      page.locator('img[srcset*="unaHero"]').first(),
    ).toBeAttached();
  });

  test("CTAs vode na pravu stranicu", async ({ page }) => {
    await page.goto("/");

    // Zakaži termin → /zakazi
    await expect(
      page.getByRole("link", { name: "Zakaži termin" }).first(),
    ).toHaveAttribute("href", /\/zakazi/);

    // Saznaj više → /o-meni
    await expect(
      page.getByRole("link", { name: /Saznaj više/i }).first(),
    ).toHaveAttribute("href", /\/o-meni/);
  });

  test("social linkovi vode na Instagram i TikTok", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /Instagram/i }),
    ).toHaveAttribute("href", /instagram\.com/);

    await expect(
      page.getByRole("link", { name: /TikTok/i }),
    ).toHaveAttribute("href", /tiktok\.com/);
  });
});
```

- [ ] **Step 2: Pokreni testove**

Predpostavlja dev server na port 3000 (postojeći). Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  DOTENV_CONFIG_PATH=.env.local \
  npx playwright test landing-hero-minimalist --reporter=list
```
Expected: 3/3 pass.

**Ako fail-uje:** najvjerovatnije zato što dev server nije pokrenut ILI port se mijenja. Alternativno port 3001 itd.

- [ ] **Step 3: Commit**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
git add tests/e2e/landing-hero-minimalist.spec.ts
git commit -m "test(e2e): landing hero minimalist — slogan + Una portret + CTAs + social

3 testa: 'manje je više' h1 visible + Una portret u DOM-u, CTAs vode na
/zakazi i /o-meni, social linkovi vode na Instagram/TikTok.
"
```

---

## Task 5: Push + PR

- [ ] **Step 1: Provjeri working tree**

Run: `cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && git status`
Expected: clean.

- [ ] **Step 2: Push branch**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
git push -u origin feature/hero-minimalist-b
```
Expected: branch pushed.

- [ ] **Step 3: Otvori PR**

Run:
```bash
gh pr create --base main --head feature/hero-minimalist-b \
  --title "feat(hero): minimalist editorial (varijanta B za korisničku procjenu)" \
  --body "$(cat <<'EOF'
**Spec:** [\`docs/superpowers/specs/2026-05-11-hero-minimalist-design.md\`](https://github.com/stpauli98/Una/blob/feature/hero-minimalist-b/docs/superpowers/specs/2026-05-11-hero-minimalist-design.md)
**Plan:** [\`docs/superpowers/plans/2026-05-11-hero-minimalist.md\`](https://github.com/stpauli98/Una/blob/feature/hero-minimalist-b/docs/superpowers/plans/2026-05-11-hero-minimalist.md)

## Summary

**Varijanta B** za hero sekciju — editorial minimalist sa Una portretom + rose krug + 'manje je / više.' slogan.

Alternativa za **PR #13** (varijanta A: scroll-driven bento gallery). Korisnica testira oba Vercel preview-a i mergeuje jedan.

## Tehnički highlights

- Brand-adapted iz vanjskog \`minimalist-hero\` template-a (yellow→rose, shadcn tokens→UP Beauty boje)
- Una portret (\`/images/unaHero.png\`, 422×591 PNG sa transparent pozadinom)
- 3-stupca grid (opis · krug+portret · slogan) → 1-stupac vertical stack na mobile
- Entrance animacije sa staggered delay-em (krug 0.2s → portret 0.4s → tekstovi 0.8-1.0s → footer 1.2s)
- Postojeća \`Nav\` komponenta sa \`overHero={true}\` ostaje iznad

## Trade-offs vs A

| | A (PR #13) | B (ovaj PR) |
|---|---|---|
| Vibe | Wow lookbook, dinamičan | Mirno editorial, statičan |
| Slika | 5 studio fotki bento grid | 1 portret + rose krug |
| Scroll | 250vh, animirano | h-screen, jedan ekran |
| Mobile | Static fallback | Vertical stack |
| Conversion | 2 CTAs (gold + outline) | Zakaži termin (gold) + Saznaj više link |

## Test plan

- [x] Typecheck + build pass
- [x] E2E: 3/3 (\`npm run test:e2e:local -- landing-hero-minimalist\`)
- [ ] Vercel preview build
- [ ] Manuelni: desktop 1440px + 1920px (krug ne pokriva tekst desno)
- [ ] Manuelni: mobile real device (vertical stack čitljiv)

## Rollout

- Korisnica testira oba Vercel preview-a (PR #13 i PR #14)
- Bira jedan i mergeuje, drugi zatvara sa komentarom

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL je vraćen.

---

## Spec Coverage Self-Review

| Spec sekcija | Task |
|---|---|
| HeroMinimalist komponenta sa 3-stupca layout | Task 2 |
| Rose krug + Una portret centriran | Task 2 |
| "manje je / više." slogan desno | Task 2 |
| Paragraf + Saznaj više + Zakaži termin CTA lijevo | Task 2 |
| Social linkovi (IG + TikTok) + lokacija u footer-u | Task 2 |
| Entrance animacije sa staggered delay-em | Task 2 |
| Postojeća Nav komponenta iznad | (već u page.tsx, ne diramo) |
| Hero wrapper postaje thin wrapper | Task 3 |
| Brand color adaptacija (yellow→rose, shadcn→UP Beauty) | Task 2 |
| Mobile responsive (3-stupca → 1-stupac) | Task 2 (grid-cols-1 md:grid-cols-3) |
| Accessibility (alt text, aria-hidden, focus rings, prefers-reduced-motion) | Task 2 |
| E2E (slogan + Una + CTAs + social) | Task 4 |
| Push + PR ka main | Task 5 |
| motion@^12 dependency | Task 1 |

Sve sekcije pokrivene. Type konzistentnost: `BUSINESS` iz konstante svuda, `motion/react` import svuda, brand boje (`bg-rose/90`, `bg-marble`, `text-dark`, `text-light`, `text-body`, `bg-gold`) konzistentne kroz komponentu i test.

**Placeholder scan:** nema TBD/TODO/`// ...`. Svi code blokovi imaju kompletan kod. Sve komande imaju Expected output. PR body koristi escaped placeholder za `<EOF>` heredoc samo (ne logički placeholder).
