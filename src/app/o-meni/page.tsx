import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { BreadcrumbsJsonLd } from "@/components/public/BreadcrumbsJsonLd";
import { BUSINESS } from "@/lib/constants/business";

export const metadata: Metadata = {
  title: "O meni",
  description:
    "Una Peranović — vlasnica UP Makeup u Gradišci. Priča o strasti prema šminkanju i prirodnoj ljepoti.",
  alternates: { canonical: "/o-meni" },
  openGraph: { url: "/o-meni" },
};

export default function OMeniPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <>
      <BreadcrumbsJsonLd
        items={[
          { name: "Početna", path: "/" },
          { name: "O meni", path: "/o-meni" },
        ]}
        siteUrl={siteUrl}
      />
      <Nav />
      <main className="pt-28">
        <section className="bg-marble px-6 py-16 md:py-24">
          <div className="mx-auto max-w-[900px]">
            <SectionHeader
              eyebrow="Upoznajte me"
              title="Una Peranović"
              as="h1"
              className="mb-12"
            />

            <div className="grid gap-12 md:grid-cols-[320px_1fr] md:items-start md:gap-14">
              <div className="relative mx-auto w-[75%] max-w-[280px] md:mx-0 md:w-auto">
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
                  <Image
                    src="/images/una-portret.jpg"
                    alt="Una Peranović sa pedikir certifikatom u salonu"
                    fill
                    sizes="(min-width: 768px) 320px, 75vw"
                    className="object-cover"
                  />
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
