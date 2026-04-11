import type { Metadata } from "next";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { BUSINESS } from "@/lib/constants/business";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Politika privatnosti UP Beauty & Makeup Studio.",
  alternates: { canonical: "/politika-privatnosti" },
};

export default function PolitikaPrivatnostiPage() {
  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-marble px-6 py-16 md:py-24">
          <div className="mx-auto max-w-[760px]">
            <h1 className="mb-2 font-display text-4xl font-light text-dark md:text-5xl">
              Politika privatnosti
            </h1>
            <p className="mb-10 text-xs uppercase tracking-[0.25em] text-light">
              Posljednja izmjena: april 2026.
            </p>

            <div className="space-y-6 text-[14px] leading-relaxed text-body">
              <p>
                Vaša privatnost nam je važna. Ovaj dokument objašnjava kako{" "}
                {BUSINESS.name} prikuplja, koristi i čuva vaše lične podatke kada
                posjetite naš sajt ili zakažete termin.
              </p>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Koje podatke prikupljamo
                </h2>
                <p>
                  Prilikom zakazivanja termina prikupljamo: ime i prezime, broj
                  telefona, email adresu (opciono) i napomene koje ste dobrovoljno
                  unijeli. Ovi podaci su nam potrebni isključivo da bismo vas
                  kontaktirali i potvrdili vaš termin.
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Kako koristimo podatke
                </h2>
                <ul className="list-inside list-disc space-y-1 pl-2">
                  <li>
                    Za potvrdu i organizaciju zakazanih termina.
                  </li>
                  <li>
                    Za kontaktiranje u slučaju izmjene ili otkazivanja termina.
                  </li>
                  <li>
                    Nikada ne dijelimo niti prodajemo vaše podatke trećim
                    stranama.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Čuvanje podataka
                </h2>
                <p>
                  Vaše podatke čuvamo onoliko dugo koliko je potrebno za
                  obavljanje naših usluga — najčešće do 12 mjeseci od posljednjeg
                  termina. Nakon toga podaci se brišu ili anonimizuju.
                </p>
              </div>

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Vaša prava
                </h2>
                <p>
                  U svakom trenutku imate pravo da zatražite pristup svojim
                  podacima, njihovu izmjenu ili brisanje. Za bilo koji zahtjev
                  kontaktirajte nas putem emaila{" "}
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

              <div>
                <h2 className="mb-2 font-display text-xl text-dark">
                  Kolačići (cookies)
                </h2>
                <p>
                  Naš sajt koristi isključivo funkcionalne kolačiće neophodne za
                  rad (npr. za pamćenje vaše saglasnosti na ovaj banner).
                  Ne koristimo analitičke niti marketinške kolačiće trećih
                  strana.
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
