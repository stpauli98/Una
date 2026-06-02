import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { ServiceCard } from "@/components/public/ServiceCard";
import { ServicesJsonLd } from "@/components/public/ServicesJsonLd";
import { BreadcrumbsJsonLd } from "@/components/public/BreadcrumbsJsonLd";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export const metadata: Metadata = {
  title: "Usluge šminkanja u Gradišci",
  description:
    "Sve usluge šminkanja u Gradišci — svadbeno, večernje, maturalno, terensko šminkanje. Pedikir, trepavice i obuka šminkanja. Profesionalni rad Une Peranović u UP Makeup.",
  alternates: { canonical: "/usluge" },
  openGraph: { url: "/usluge" },
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Cookie-free klijent → static prerender + Vercel CDN cache za bot scraper-e
  const supabase = createPublicClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("order_index");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const grouped = (services ?? []).reduce<Record<string, Service[]>>(
    (acc, service) => {
      (acc[service.category] ??= []).push(service);
      return acc;
    },
    {},
  );

  return (
    <>
      <ServicesJsonLd services={services ?? []} siteUrl={siteUrl} />
      <BreadcrumbsJsonLd
        items={[
          { name: "Početna", path: "/" },
          { name: "Usluge", path: "/usluge" },
        ]}
        siteUrl={siteUrl}
      />
      <Nav />
      <main className="pt-28">
        <section className="bg-warm px-6 py-16 md:py-24">
          <SectionHeader
            eyebrow="Naša ponuda"
            title="Usluge šminkanja u Gradišci"
            as="h1"
            className="mb-14"
          />

          <div className="mx-auto max-w-[1200px] space-y-16">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <h2 className="mb-6 text-center font-display text-2xl text-dark md:text-3xl">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <div className="mx-auto grid max-w-[480px] grid-cols-1 gap-4 md:max-w-[760px] md:grid-cols-2 md:gap-5 lg:max-w-[1100px] lg:grid-cols-4">
                    {items.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        imageUrl={
                          service.image_path
                            ? `${supabaseUrl}/storage/v1/object/public/services/${service.image_path}`
                            : undefined
                        }
                        featured={service.bookable}
                        headingLevel="h3"
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
