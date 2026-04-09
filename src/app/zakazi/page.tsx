import type { Metadata } from "next";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Zakaži termin",
  description:
    "Zakažite termin online u UP Beauty & Makeup Studio — šminkanje, pedikir, trepavice. Tri koraka, bez čekanja.",
};

// Booking stranica se ne smije keširati — uvijek svježi podaci o uslugama
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ service?: string }>;
};

export default async function ZakaziPage({ searchParams }: PageProps) {
  const { service: serviceParam } = await searchParams;

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("bookable", true)
    .eq("active", true)
    .neq("category", "obuka")
    .order("order_index");

  const initialServiceId = serviceParam ? Number(serviceParam) : null;
  const validInitialId =
    initialServiceId &&
    (services ?? []).some((s) => s.id === initialServiceId)
      ? initialServiceId
      : null;

  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-warm px-6 py-16 md:py-24">
          <BookingFlow
            services={services ?? []}
            initialServiceId={validInitialId}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
