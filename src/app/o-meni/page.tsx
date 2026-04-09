import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { BUSINESS } from "@/lib/constants/business";

export const metadata: Metadata = {
  title: "O meni",
  description:
    "Una Peranović — vlasnica UP Beauty & Makeup Studio u Gradišci. Priča o strasti prema šminkanju i prirodnoj ljepoti.",
};

export default function OMeniPage() {
  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-marble px-6 py-16 md:py-24">
          <div className="mx-auto max-w-[900px]">
            <SectionHeader
              eyebrow="Upoznajte me"
              title="Una Peranović"
              className="mb-12"
            />

            <div className="grid gap-12 md:grid-cols-[320px_1fr] md:items-start md:gap-14">
              <div className="relative mx-auto w-[75%] max-w-[280px] md:mx-0 md:w-auto">
                <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-sm bg-gradient-to-br from-blush to-pink">
                  <span className="font-display text-[52px] font-light text-white/50">
                    UP
                  </span>
                  <span className="mt-1.5 text-[9px] uppercase tracking-[0.3em] text-white/40">
                    Vaša fotografija
                  </span>
                </div>
                <div
                  aria-hidden
                  className="absolute right-[-12px] top-[-12px] -z-10 h-[55%] w-[55%] rounded-sm border border-gold-light"
                />
              </div>

              <div className="text-[14px] leading-relaxed text-body">
                <p className="mb-4">
                  Dobrodošli u moj mali svijet magije. Ja sam Una, mlada
                  poduzetnica iz Gradiške sa strašću za šminkanjem i njegom.
                  Moje ime je sinonim za prirodnu i neutralnu estetiku —
                  vjerujem da šminka treba da naglasi, a ne da prikrije.
                </p>
                <p className="mb-4">
                  Kroz svaki potez četkice, trudim se da naglasim žensku
                  ljepotu na suptilan, ali istovremeno efektan način. Od
                  dnevnog make-upa do svadbenih priprema — svaki tretman je
                  pažljivo kreiran za vas.
                </p>
                <p className="mb-4">
                  Pored šminkanja, u mom studiju možete uživati u spa
                  pedikiru, nadograđivanju trepavica (metoda 1:1) i kompletnoj
                  obuci za šminkanje za one koji žele da i sami ovladaju ovim
                  zanatom.
                </p>
                <p className="mb-6">
                  Jedva čekam da vas upoznam i doprinesem da se u svojoj koži
                  osjećate najljepše moguće.
                </p>
                <p className="mb-8 font-display text-[26px] font-light italic text-rose">
                  {BUSINESS.owner}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/zakazi"
                    className="inline-block bg-rose px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover"
                  >
                    Zakaži termin
                  </Link>
                  <Link
                    href="/obuka"
                    className="inline-block border border-rose bg-transparent px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-rose transition-colors hover:bg-rose hover:text-white"
                  >
                    Obuka za šminkanje
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
