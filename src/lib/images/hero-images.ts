/**
 * Statična lista slika za hero sekciju.
 *
 * `HERO_IMAGES` — desktop animirani bento (scroll-driven, 5 grid cell-a).
 * Redoslijed je VIDLJIV: prva je velika featured (col-span-8 row-span-3),
 * ostale popunjavaju manje pozicije u bento layout-u.
 *
 * `HERO_MOBILE_IMAGE` — full-bleed slika za mobile fallback (<md) i
 * korisnike sa `prefers-reduced-motion`. Razdvojeno od desktop bento-a
 * jer mobile traži portrait-orijentisan kadar a desktop bento featured
 * traži landscape (col-span-8 row-span-3).
 *
 * Fajlovi se učitavaju kroz `next/image` (public asset), `quality={90}`.
 * Folder sadrži dodatne slike koje nisu u registry — rezerva za buduće
 * reorder ili swap.
 */

export const HERO_IMAGES = [
  "/images/hero-section-v2/13bbdadb-642b-438c-83a7-170c9aa1c1dd.webp",
  "/images/hero-section-v2/1c3f575a-5fa3-4b47-acef-e9961cb95732.webp",
  "/images/hero-section-v2/3ccf37ba-bfb7-42c4-9d31-f842bbec195b.webp",
  "/images/hero-section-v2/41581c1d-d17e-4bbd-8444-8f610b19b588.webp",
  "/images/hero-section-v2/94629d3b-5547-40a1-86bd-48b2703ef221.webp",
] as const;

export const HERO_MOBILE_IMAGE =
  "/images/hero-section-v2/e9fc1e3b-d963-4b96-87ab-ccfa47fcd8e4.webp";

export type HeroImage = (typeof HERO_IMAGES)[number];
