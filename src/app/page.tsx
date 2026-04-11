import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { Hero } from "@/components/public/Hero";
import { SectionHeader } from "@/components/public/SectionHeader";
import { ServiceCard } from "@/components/public/ServiceCard";
import { TestimonialsCarousel } from "@/components/public/TestimonialsCarousel";
import { LocalBusinessJsonLd } from "@/components/public/LocalBusinessJsonLd";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS } from "@/lib/constants/business";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 300; // 5 min ISR

export default async function HomePage() {
  const supabase = await createClient();

  const { data: featuredServices } = await supabase
    .from("services")
    .select("*")
    .eq("bookable", true)
    .eq("active", true)
    .order("order_index")
    .limit(4);

  return (
    <>
      <LocalBusinessJsonLd />
      <Nav overHero />
      <main>
        <Hero />

        {/* USLUGE */}
        <section className="bg-warm px-6 py-[60px] md:py-[90px] lg:py-[110px]">
          <div className="mx-auto max-w-[1200px]">
            <SectionHeader
              eyebrow="Šta nudim"
              title="Naše usluge"
              className="mb-11"
            />

            <div className="mx-auto grid max-w-[480px] grid-cols-1 gap-4 md:max-w-[760px] md:grid-cols-2 md:gap-5 lg:max-w-[1100px] lg:grid-cols-4">
              {(featuredServices ?? []).map((service) => (
                <ServiceCard key={service.id} service={service} featured />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/usluge"
                className="inline-flex items-center gap-1.5 bg-rose px-9 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover"
              >
                Sve usluge
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* O MENI */}
        <section className="bg-marble px-6 py-[60px] md:py-[90px] lg:py-[110px]">
          <div className="mx-auto flex max-w-[900px] flex-col items-center gap-8 md:flex-row md:gap-14">
            <div className="relative w-[75%] max-w-[280px] md:w-auto md:flex-[0_0_320px]">
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
                className="absolute right-[-10px] top-[-10px] -z-10 h-[55%] w-[55%] rounded-sm border border-gold-light"
              />
            </div>

            <div className="max-w-[420px] text-center md:text-left">
              <p className="mb-3 font-display text-xs italic uppercase tracking-[0.3em] text-rose">
                O meni
              </p>
              <h2 className="mb-4 font-display text-[clamp(26px,4vw,38px)] font-light leading-tight text-dark">
                Sjajne stvari nastaju
                <br />
                iz strasti
              </h2>
              <p className="mb-4 text-[13px] leading-relaxed text-body">
                Dobrodošli u moj mali svijet magije. Ja sam Una, mlada
                poduzetnica sa strašću za šminkanjem. Moje ime je sinonim za
                prirodnu i neutralnu estetiku.
              </p>
              <p className="mb-7 text-[13px] leading-relaxed text-body">
                Kroz svaki potez četkice, naglašavam žensku ljepotu na suptilan,
                ali istovremeno efektan način.
              </p>
              <p className="mb-4 font-display text-[26px] font-light italic text-rose">
                {BUSINESS.owner}
              </p>
              <Link
                href="/o-meni"
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-dark underline-offset-4 hover:text-rose hover:underline"
              >
                Pročitaj više
                <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="bg-gradient-to-br from-dark to-[#5a3e3e] px-6 py-[60px] md:py-[90px] lg:py-[110px]">
          <SectionHeader
            eyebrow="Utisci"
            title="Šta kažu klijentice"
            light
            className="mb-9"
          />
          <TestimonialsCarousel />
        </section>

        {/* BOOKING CTA */}
        <section className="bg-warm px-6 py-[60px] text-center md:py-[90px]">
          <p className="mb-3 font-display text-xs italic uppercase tracking-[0.3em] text-gold">
            Online zakazivanje
          </p>
          <h2 className="mb-4 font-display text-[clamp(28px,4.5vw,40px)] font-light leading-tight text-dark">
            Zakaži termin u par klikova
          </h2>
          <p className="mx-auto mb-8 max-w-[460px] text-[13px] leading-relaxed text-body">
            Izaberi uslugu, slobodan termin i potvrdi rezervaciju. Bez čekanja i
            pozivanja.
          </p>
          <Link
            href="/zakazi"
            className="inline-block bg-rose px-10 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white transition-colors hover:bg-rose-hover"
          >
            Zakaži termin
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
