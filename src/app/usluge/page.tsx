import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { ServiceCard } from "@/components/public/ServiceCard";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export const metadata: Metadata = {
  title: "Usluge",
  description:
    "Profesionalno šminkanje, pedikir, trepavice i obuka u UP Beauty Studio u Gradišci. Pogledajte sve usluge i cijene.",
  alternates: { canonical: "/usluge" },
};

export const revalidate = 300;

const CATEGORY_LABELS: Record<string, string> = {
  sminkanje: "Šminkanje",
  pedikir: "Pedikir",
  trepavice: "Trepavice",
  obuka: "Obuka",
};

const CATEGORY_ORDER = ["sminkanje", "pedikir", "trepavice", "obuka"] as const;

export default async function UslugePage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("order_index");

  const grouped = (services ?? []).reduce<Record<string, Service[]>>(
    (acc, service) => {
      (acc[service.category] ??= []).push(service);
      return acc;
    },
    {},
  );

  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-warm px-6 py-16 md:py-24">
          <SectionHeader
            eyebrow="Naša ponuda"
            title="Sve usluge"
            className="mb-14"
          />

          <div className="mx-auto max-w-[1200px] space-y-16">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <h3 className="mb-6 text-center font-display text-2xl text-dark md:text-3xl">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <div className="mx-auto grid max-w-[480px] grid-cols-1 gap-4 md:max-w-[760px] md:grid-cols-2 md:gap-5 lg:max-w-[1100px] lg:grid-cols-4">
                    {items.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        featured={service.bookable}
                        headingLevel="h4"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/zakazi"
              className="inline-block bg-rose px-10 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white transition-colors hover:bg-rose-hover"
            >
              Zakaži termin
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
