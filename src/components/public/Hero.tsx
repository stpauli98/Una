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
