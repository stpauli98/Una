"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BentoCell,
  BentoGrid,
  ContainerOverlay,
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

      {/* Dark overlay za čitljivost teksta — gase se zajedno sa naslovom */}
      <ContainerOverlay className="z-[5] bg-gradient-to-b from-dark/70 via-dark/55 to-dark/70" />

      <ContainerScale className="relative z-10 text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-gold-light" />
          <p className="font-display text-[13px] italic uppercase tracking-[0.35em] text-gold-light md:text-[14px]">
            Beauty Studio · Gradiška
          </p>
          <div className="h-px w-10 bg-gold-light" />
        </div>

        <h1 className="mb-6 font-display text-[44px] font-normal leading-[1.08] tracking-wide text-white drop-shadow-lg sm:text-[56px] md:text-[80px] lg:text-[100px]">
          Osmijeh je
          <br />
          <em className="italic font-light">najljepša</em> šminka
        </h1>

        <p className="mx-auto mb-10 max-w-[360px] text-[15px] leading-relaxed tracking-wide text-white drop-shadow-md md:max-w-[520px] md:text-[17px] lg:text-[18px]">
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
