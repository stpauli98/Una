"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { label: "Početna", href: "/" },
  { label: "Usluge", href: "/usluge" },
  { label: "Galerija", href: "/galerija" },
  { label: "Cjenovnik", href: "/cjenovnik" },
  { label: "O meni", href: "/o-meni" },
  { label: "Kontakt", href: "/kontakt" },
] as const;

type NavProps = {
  /** Kad je true, nav starta transparentan (koristi se na stranicama sa punim hero-om iznad). */
  overHero?: boolean;
};

export function Nav({ overHero = false }: NavProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(!overHero);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!overHero) return;
    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [overHero]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Kada je mobile meni otvoren, overlay ima svijetlu marble pozadinu pa
  // nav elementi (hamburger, logo) moraju biti tamni da bi bili vidljivi.
  const solid = scrolled || !overHero || menuOpen;

  return (
    <>
      <nav
        className={cn(
          "fixed inset-x-0 top-0 z-[60] transition-all duration-400",
          menuOpen
            ? "bg-transparent border-b border-transparent py-4"
            : solid
              ? "bg-marble/95 backdrop-blur-md border-b border-cream py-3"
              : "bg-transparent border-b border-transparent py-4",
        )}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="UP Beauty & Makeup Studio — početna"
          >
            <span
              className={cn(
                "font-display text-[26px] font-semibold tracking-[0.15em] transition-colors duration-400",
                solid ? "text-dark" : "text-white",
              )}
            >
              UP
            </span>
            <span
              className={cn(
                "text-[8px] uppercase tracking-[0.2em] leading-tight transition-colors duration-400",
                solid ? "text-light" : "text-white/65",
              )}
            >
              Beauty &<br />
              Makeup Studio
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-7 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-[11px] uppercase tracking-[0.25em] transition-colors duration-300 hover:text-rose",
                  solid ? "text-dark" : "text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/zakazi"
              className="bg-gold px-5 py-2.5 text-[10px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#A17E47]"
            >
              Zakaži termin
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="flex flex-col gap-1 bg-transparent p-2 md:hidden cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
            aria-expanded={menuOpen}
          >
            <span
              className={cn(
                "h-[1.5px] w-[22px] transition-all duration-300",
                solid ? "bg-dark" : "bg-white",
                menuOpen && "translate-y-[6px] rotate-45",
              )}
            />
            <span
              className={cn(
                "h-[1.5px] w-[22px] transition-all duration-300",
                solid ? "bg-dark" : "bg-white",
                menuOpen && "opacity-0",
              )}
            />
            <span
              className={cn(
                "h-[1.5px] w-[22px] transition-all duration-300",
                solid ? "bg-dark" : "bg-white",
                menuOpen && "-translate-y-[6px] -rotate-45",
              )}
            />
          </button>
        </div>
      </nav>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-marble md:hidden">
          {NAV_ITEMS.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-3xl text-dark"
              style={{
                animation: `fadeUp 0.4s ease ${i * 60}ms both`,
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/zakazi"
            className="mt-4 bg-rose px-8 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white"
          >
            Zakaži termin
          </Link>
        </div>
      )}
    </>
  );
}
