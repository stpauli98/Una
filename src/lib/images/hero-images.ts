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
 * V2 varijanta — koristi 5 slika iz `public/images/hero-section-v2/`.
 * Ostali fajlovi u tom folderu (npr. 5 dodatnih) ostaju u repo-u za
 * eventualno reorder ili buduće korišćenje.
 */
export const HERO_IMAGES = [
  "/images/hero-section-v2/e9fc1e3b-d963-4b96-87ab-ccfa47fcd8e4.webp",
  "/images/hero-section-v2/28ba9d00-a80b-4119-bde2-b201710413ba.webp",
  "/images/hero-section-v2/8b576802-7348-46f1-b7ab-4d6edb7b3ff1.webp",
  "/images/hero-section-v2/3ecedec1-35a6-4b09-9abf-9bb17b037ec6.webp",
  "/images/hero-section-v2/81d02e03-7238-42a4-a47b-7f36fb3338a9.webp",
] as const;

export type HeroImage = (typeof HERO_IMAGES)[number];
