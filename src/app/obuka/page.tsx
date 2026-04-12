import type { Metadata } from "next";
import { Clock, Sparkles, Users, BookOpen, MessageCircle, Phone } from "lucide-react";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { BUSINESS } from "@/lib/constants/business";
import { waLink } from "@/lib/utils/wa";

export const metadata: Metadata = {
  title: "Obuka za šminkanje",
  description:
    "Intenzivna obuka za šminkanje u UP Beauty Studio. Pet dana praktičnog rada, tehnike, savjeti i diploma. 800 KM.",
  alternates: { canonical: "/obuka" },
};

const WHATS_INCLUDED = [
  {
    icon: Clock,
    title: "5 dana",
    text: "Intenzivan program sa dovoljno vremena za savladavanje svakog koraka.",
  },
  {
    icon: Sparkles,
    title: "Praktičan rad",
    text: "Radićete na stvarnim modelima uz moje direktno vođenje i korekcije.",
  },
  {
    icon: Users,
    title: "Male grupe",
    text: "Maksimalno posvećenost svakom polazniku — bez prepunih termina.",
  },
  {
    icon: BookOpen,
    title: "Materijali",
    text: "Uvod u teoriju, alate, kolor teoriju i njegu kože.",
  },
] as const;

export default function ObukaPage() {
  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-warm px-6 py-16 md:py-24">
          <div className="mx-auto max-w-[900px]">
            <SectionHeader
              eyebrow="Edukacija"
              title="Obuka za šminkanje"
              className="mb-10"
            />

            <div className="mx-auto mb-12 max-w-[620px] text-center">
              <p className="text-[14px] leading-relaxed text-body">
                Ako i vi želite da savladate umjetnost šminkanja, priključite
                se mojoj intenzivnoj obuci u Gradišci. Kroz pet dana praktičnog
                rada, naučit ćete tehnike koje se koriste u profesionalnim
                studijima — od dnevnog make-upa do večernjih i svadbenih
                stilizacija.
              </p>
            </div>

            <div className="mx-auto mb-12 grid max-w-[800px] gap-4 md:grid-cols-2 md:gap-5">
              {WHATS_INCLUDED.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-4 border border-cream bg-white p-5"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warm text-rose">
                      <Icon size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="mb-1 font-display text-lg text-dark">
                        {item.title}
                      </h3>
                      <p className="text-[12px] leading-relaxed text-light">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mx-auto mb-14 max-w-[420px] border border-cream bg-white p-6 text-center">
              <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-rose">
                Cijena obuke
              </p>
              <p className="font-display text-4xl font-light text-dark md:text-5xl">
                800 KM
              </p>
              <p className="mt-2 text-xs text-light">
                Uplata u dvije rate moguća po dogovoru.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-[520px] text-center">
            <h3 className="mb-3 font-display text-2xl text-dark md:text-3xl">
              Zainteresovani?
            </h3>
            <p className="mb-8 text-[13px] leading-relaxed text-body">
              Javite se direktno putem WhatsApp-a ili telefona za sve detalje
              o sljedećem terminu obuke.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={waLink(
                  BUSINESS.phoneRaw,
                  "Zdravo Una, zanima me obuka za šminkanje. Možeš li mi reći više o sljedećem terminu?",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-600 px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle size={14} />
                Pišite na WhatsApp
              </a>
              <a
                href={`tel:${BUSINESS.phoneRaw}`}
                className="inline-flex items-center justify-center gap-2 border border-cream bg-white px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-dark transition-colors hover:border-rose hover:text-rose"
              >
                <Phone size={14} />
                Pozovite {BUSINESS.phone}
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
