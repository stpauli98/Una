"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
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
              width={422}
              height={591}
              priority
              quality={90}
              className="h-auto w-80 object-contain md:w-[420px] lg:w-[500px]"
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37 Z" />
              <circle cx="17.5" cy="6.5" r="1.5" />
            </svg>
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
