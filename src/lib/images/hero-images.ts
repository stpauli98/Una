/**
 * Statična lista slika za hero sekciju (kako desktop animirani, tako
 * static fallback).
 *
 * Redoslijed je VIDLJIV — prva slika je velika u bento layout-u i također
 * jedina slika koju koristi `HeroStatic` mobile/reduced-motion fallback.
 *
 * Fajlovi se učitavaju kroz `next/image` (public asset), `quality={90}`
 * (dozvoljeno kroz `images.qualities` u next.config.ts).
 *
 * Trenutni set: salon enterijer (umjesto klijent portreta) iz
 * `public/images/hero-section-v2/`. Folder sadrži još 3 dodatne slike
 * koje nisu u registry — rezerva za buduće reorder ili izmjenu prve
 * featured pozicije.
 */
export const HERO_IMAGES = [
  "/images/hero-section-v2/13bbdadb-642b-438c-83a7-170c9aa1c1dd.webp",
  "/images/hero-section-v2/1c3f575a-5fa3-4b47-acef-e9961cb95732.webp",
  "/images/hero-section-v2/3ccf37ba-bfb7-42c4-9d31-f842bbec195b.webp",
  "/images/hero-section-v2/41581c1d-d17e-4bbd-8444-8f610b19b588.webp",
  "/images/hero-section-v2/94629d3b-5547-40a1-86bd-48b2703ef221.webp",
] as const;

export type HeroImage = (typeof HERO_IMAGES)[number];
