import type { Metadata } from "next";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export const metadata: Metadata = {
  title: "Cjenovnik šminkanja Gradiška",
  description:
    "Cijene šminkanja u Gradišci — svadbeno, večernje, maturalno, terensko. Pedikir, trepavice, obuka. Sve cijene u KM. UP Beauty & Makeup Studio kod Une Peranović.",
  alternates: { canonical: "/cjenovnik" },
  openGraph: { url: "/cjenovnik" },
};

export const revalidate = 300;

const CATEGORY_LABELS: Record<string, string> = {
  sminkanje: "Šminkanje",
  pedikir: "Pedikir",
  trepavice: "Trepavice",
  obuka: "Obuka",
};

const CATEGORY_ORDER = ["sminkanje", "pedikir", "trepavice", "obuka"] as const;

export default async function CjenovnikPage() {
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
        <section className="bg-marble px-6 py-16 md:py-24">
          <SectionHeader
            eyebrow="Cijene"
            title="Cjenovnik"
            className="mb-14"
          />

          <div className="mx-auto grid max-w-[460px] gap-5 md:max-w-[760px] md:grid-cols-2 md:items-start lg:max-w-[1000px] lg:grid-cols-3">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div
                  key={cat}
                  className="overflow-hidden border border-cream bg-white"
                >
                  <div className="border-b border-cream bg-warm px-5 py-4 text-center">
                    <h3 className="font-display text-xl font-medium text-dark">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                  </div>
                  <ul className="px-5 pb-4 pt-1">
                    {items.map((service, i) => (
                      <li
                        key={service.id}
                        className={`flex items-center justify-between py-3.5 ${
                          i < items.length - 1 ? "border-b border-cream" : ""
                        }`}
                      >
                        <div className="flex-1 pr-3">
                          <p className="text-[13px] text-body">
                            {service.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-light">
                            {service.duration_note ??
                              formatDuration(service.duration_min)}
                          </p>
                        </div>
                        <span className="font-display text-[17px] font-medium text-rose">
                          {service.price_note ??
                            formatPrice(Number(service.price))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-10 max-w-[560px] text-center text-[12px] leading-relaxed text-light">
            Cijene mogu biti dodatno prilagođene u zavisnosti od zahtjeva
            (npr. terensko šminkanje). Za tačnu ponudu kontaktirajte studio.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
