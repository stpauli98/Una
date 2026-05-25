import Link from "next/link";
import Image from "next/image";
import { HERO_MOBILE_IMAGE } from "@/lib/images/hero-images";

/**
 * Static hero — mobile (< md breakpoint) ili korisnici sa
 * prefers-reduced-motion. Jedan full-bleed foto + gradient overlay +
 * brand-styled naslov + 2 CTA.
 *
 * Mobile koristi posebnu `HERO_MOBILE_IMAGE` (portrait orijentisana
 * salon foto), ne `HERO_IMAGES[0]` (koja je optimizirana za landscape
 * desktop bento featured cell).
 *
 * Renderuje se kao Server Component (default) — nema interaktivnosti.
 */
export function HeroStatic() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pb-16 pt-28">
      <Image
        src={HERO_MOBILE_IMAGE}
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
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-gold-light" />
          <p className="font-display text-[13px] italic uppercase tracking-[0.35em] text-gold-light md:text-[14px]">
            Makeup · Gradiška
          </p>
          <div className="h-px w-10 bg-gold-light" />
        </div>

        <h1 className="mb-6 font-display text-[44px] font-normal leading-[1.08] tracking-wide text-white drop-shadow-sm sm:text-[56px] md:text-[80px] lg:text-[100px]">
          Osmijeh je
          <br />
          <em className="italic font-light">najljepša</em> šminka
        </h1>

        <p className="mx-auto mb-10 max-w-[360px] text-[15px] leading-relaxed tracking-wide text-white/80 md:max-w-[520px] md:text-[17px] lg:text-[18px]">
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
