import Link from "next/link";
import { Camera, Music2, Mail } from "lucide-react";
import { BUSINESS } from "@/lib/constants/business";

export function Footer() {
  return (
    <footer className="bg-dark px-6 pb-6 pt-12 text-center text-white">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="font-display text-2xl font-semibold tracking-[0.15em] text-white">
            UP
          </span>
          <span className="text-[8px] uppercase leading-tight tracking-[0.2em] text-white/30">
            Beauty &<br />
            Makeup Studio
          </span>
        </div>

        <nav className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Link
            href="/usluge"
            className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Usluge
          </Link>
          <Link
            href="/galerija"
            className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Galerija
          </Link>
          <Link
            href="/o-meni"
            className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            O meni
          </Link>
          <Link
            href="/kontakt"
            className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Kontakt
          </Link>
          <Link
            href="/obuka"
            className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Obuka
          </Link>
          <Link
            href="/zakazi"
            className="text-[10px] uppercase tracking-[0.2em] text-gold-light hover:text-white"
          >
            Zakaži termin
          </Link>
        </nav>

        <div className="mb-6 flex justify-center gap-3">
          <a
            href={BUSINESS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-11 items-center justify-center rounded-full border border-white/15 text-white/50 hover:border-white/40 hover:text-white"
            aria-label="Instagram"
          >
            <Camera size={14} strokeWidth={1.5} />
          </a>
          <a
            href={BUSINESS.tiktok}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-11 items-center justify-center rounded-full border border-white/15 text-white/50 hover:border-white/40 hover:text-white"
            aria-label="TikTok"
          >
            <Music2 size={14} strokeWidth={1.5} />
          </a>
          <a
            href={`mailto:${BUSINESS.email}`}
            className="flex size-11 items-center justify-center rounded-full border border-white/15 text-white/50 hover:border-white/40 hover:text-white"
            aria-label="Email"
          >
            <Mail size={14} strokeWidth={1.5} />
          </a>
        </div>

        <div className="mb-4 space-y-1 text-[11px] text-white/40">
          <p>{BUSINESS.address}</p>
          <p>
            <a
              href={`tel:${BUSINESS.phoneRaw}`}
              className="hover:text-white"
            >
              {BUSINESS.phone}
            </a>
            {" · "}
            <a
              href={`mailto:${BUSINESS.email}`}
              className="hover:text-white"
            >
              {BUSINESS.email}
            </a>
          </p>
        </div>

        <div className="border-t border-white/5 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-white/30">
            <Link
              href="/politika-privatnosti"
              className="hover:text-white/60"
            >
              Politika privatnosti
            </Link>
            <span>·</span>
            <Link
              href="/uslovi-koriscenja"
              className="hover:text-white/60"
            >
              Uslovi korišćenja
            </Link>
          </div>
          <p className="text-[10px] tracking-wide text-white/20">
            © {new Date().getFullYear()} {BUSINESS.name} · Izrada:{" "}
            <span className="text-gold-light">NextPixel</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
