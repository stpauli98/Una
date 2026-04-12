import Link from "next/link";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 items-center justify-center px-6 pt-28">
        <div className="py-20 text-center">
          <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-rose">
            Stranica nije pronađena
          </p>
          <h1 className="mb-4 font-display text-6xl font-light text-dark md:text-8xl">
            404
          </h1>
          <p className="mb-8 text-[14px] text-body">
            Stranica koju tražite ne postoji ili je premještena.
          </p>
          <Link
            href="/"
            className="inline-block bg-rose px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover"
          >
            Nazad na početnu
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
