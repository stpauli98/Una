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
