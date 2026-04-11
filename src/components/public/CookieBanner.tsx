"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "up-beauty-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) !== "accepted") {
      // Pokaži tek nakon kratkog delay-a da ne skače sa hero-om
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Obavještenje o kolačićima"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[580px] border border-cream bg-white/98 p-4 shadow-lg backdrop-blur-md md:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="mb-2 text-[13px] font-medium text-dark">
            Ovaj sajt koristi samo funkcionalne kolačiće
          </p>
          <p className="text-[12px] leading-relaxed text-light">
            Koristimo isključivo tehničke kolačiće neophodne za rad sajta. Bez
            analitike, bez oglasa, bez dijeljenja podataka.{" "}
            <Link
              href="/politika-privatnosti"
              className="text-rose underline-offset-2 hover:underline"
            >
              Pročitaj više
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={accept}
          aria-label="Prihvati i zatvori"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-light transition-colors hover:bg-warm hover:text-dark cursor-pointer"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <button
        type="button"
        onClick={accept}
        className="mt-3 w-full bg-rose py-3 text-[10px] uppercase tracking-[0.25em] text-white hover:bg-rose-hover cursor-pointer"
      >
        Prihvatam
      </button>
    </div>
  );
}
