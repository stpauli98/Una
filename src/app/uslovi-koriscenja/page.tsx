import type { Metadata } from "next";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { BUSINESS } from "@/lib/constants/business";

export const metadata: Metadata = {
  title: "Uslovi korišćenja",
  description: "Uslovi korišćenja sajta i usluga UP Makeup.",
  alternates: { canonical: "/uslovi-koriscenja" },
};

export default function UsloviKoriscenjaPage() {
  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-marble px-6 py-16 md:py-24">
          <div className="mx-auto max-w-[760px]">
            <h1 className="mb-2 font-display text-4xl font-light text-dark md:text-5xl">
              Uslovi korišćenja
            </h1>
            <p className="mb-10 text-xs uppercase tracking-[0.25em] text-light">
              Posljednja izmjena: april 2026.
            </p>

            <div className="space-y-6 text-[14px] leading-relaxed text-body">
              <p>
                Korišćenjem sajta {BUSINESS.name} i zakazivanjem termina,
                prihvatate sljedeće uslove. Molimo vas da ih pažljivo pročitate.
              </p>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Zakazivanje termina
                </h2>
                <p>
                  Termin koji ostavite putem online forme nije automatski
                  potvrđen. Una će vas kontaktirati (putem WhatsApp-a ili
                  telefonom) da potvrdi raspoloživost. Konačna potvrda se
                  dobija nakon ovog kontakta.
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Otkazivanje i izmjene
                </h2>
                <p>
                  Termin možete besplatno otkazati ili izmijeniti najkasnije 24
                  sata prije zakazanog vremena. Otkazivanje u kraćem roku
                  može da rezultira naplatom dijela usluge, po nahođenju
                  studija.
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Dolazak i kašnjenje
                </h2>
                <p>
                  Molimo vas da dođete na zakazano vrijeme. U slučaju
                  kašnjenja dužeg od 15 minuta, usluga može biti skraćena ili
                  termin prebačen, zavisno od rasporeda.
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Zdravlje i alergije
                </h2>
                <p>
                  Molimo vas da ne dolazite na termin ako se ne osjećate dobro,
                  imate povišenu temperaturu ili simptome respiratornih
                  infekcija. Ako imate poznate alergije na kozmetičke
                  proizvode, obavezno nas obavijestite prije početka tretmana.
                  Studio ne snosi odgovornost za reakcije koje nisu prethodno
                  prijavljene.
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Plaćanje
                </h2>
                <p>
                  Plaćanje usluga se vrši gotovinom na licu mjesta, nakon
                  završenog tretmana. Cijene su izražene u konvertibilnim
                  markama (KM).
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Kontakt
                </h2>
                <p>
                  Za sva pitanja u vezi sa uslovima korišćenja možete nas
                  kontaktirati putem{" "}
                  <a
                    href={`mailto:${BUSINESS.email}`}
                    className="text-rose hover:underline"
                  >
                    {BUSINESS.email}
                  </a>{" "}
                  ili telefona{" "}
                  <a
                    href={`tel:${BUSINESS.phoneRaw}`}
                    className="text-rose hover:underline"
                  >
                    {BUSINESS.phone}
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
