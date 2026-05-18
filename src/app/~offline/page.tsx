import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bez konekcije",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-marble px-6 text-center">
      <div className="max-w-md">
        <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-light">
          UP Beauty
        </p>
        <h1 className="mb-4 font-display text-3xl text-dark md:text-4xl">
          Trenutno ste bez konekcije
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-body">
          Ne možemo dohvatiti ovu stranicu jer telefon nije povezan na internet.
          Sačekajte da se konekcija vrati ili otvorite ranije posjećenu stranicu
          — ona radi i bez interneta.
        </p>
        <Link
          href="/"
          className="inline-block bg-rose px-8 py-3 text-[11px] uppercase tracking-[0.25em] text-white hover:bg-rose-hover"
        >
          Nazad na početnu
        </Link>
      </div>
    </main>
  );
}
