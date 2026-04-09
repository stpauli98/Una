import Link from "next/link";

/**
 * Hero sekcija — puna visina ekrana, tamni gradijent,
 * italic Cormorant headline, dva CTA dugmeta.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-dark via-[#5a3e3e] to-pink px-6 pb-16 pt-28">
      {/* Dekorativni krugovi */}
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
        <div className="mb-7 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-gold-light" />
          <p className="font-display text-[11px] italic uppercase tracking-[0.35em] text-gold-light">
            Beauty Studio · Gradiška
          </p>
          <div className="h-px w-8 bg-gold-light" />
        </div>

        <h1 className="mb-5 font-display text-[44px] font-light leading-[1.08] tracking-wide text-white md:text-[64px] lg:text-[80px]">
          Osmijeh je
          <br />
          <em className="italic">najljepša</em> šminka
        </h1>

        <p className="mx-auto mb-8 max-w-[320px] text-[13px] leading-relaxed tracking-wide text-white/55 md:max-w-[440px] md:text-[15px]">
          Profesionalno šminkanje, pedikir i njega trepavica. Vaša prirodna
          ljepota, naglašena sa stilom.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
          <Link
            href="/zakazi"
            className="bg-gold px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#A17E47]"
          >
            Zakaži termin
          </Link>
          <Link
            href="/usluge"
            className="border border-white/40 bg-transparent px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-white/10"
          >
            Pogledaj usluge
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="h-8 w-px bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  );
}
