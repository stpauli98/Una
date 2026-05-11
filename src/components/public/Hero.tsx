// src/components/public/Hero.tsx
"use client";

import { useSyncExternalStore } from "react";
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

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(callback: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot() {
  return false;
}

export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );

  if (prefersReducedMotion || !isDesktop) {
    return <HeroStatic />;
  }
  return <HeroAnimated />;
}
