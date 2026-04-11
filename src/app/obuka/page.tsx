import type { Metadata } from "next";
import { Clock, Sparkles, Users, BookOpen } from "lucide-react";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { TrainingInquiryForm } from "@/components/public/TrainingInquiryForm";

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

          <div className="mx-auto max-w-[900px]">
            <h3 className="mb-6 text-center font-display text-2xl text-dark md:text-3xl">
              Prijavite se na obuku
            </h3>
            <p className="mx-auto mb-8 max-w-[480px] text-center text-[13px] leading-relaxed text-body">
              Ostavite svoje kontakt podatke i uskoro ću vas kontaktirati sa
              detaljima o sljedećem terminu obuke.
            </p>
            <TrainingInquiryForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
