import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { ServicesManager } from "@/components/admin/ServicesManager";
import { getCachedServices } from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Usluge — Admin",
  robots: { index: false, follow: false },
};

// Bez `export const dynamic = "force-dynamic"` — koristimo cached query
// koji se invalidate-uje preko updateTag iz usluge/actions.ts.

export default async function AdminUslugePage() {
  const services = await getCachedServices();

  return (
    <div>
      <PageHeader
        title="Usluge"
        subtitle="Upravljanje katalogom usluga i cijenama"
      />
      <div className="p-5 md:p-8">
        <ServicesManager initialServices={services} />
      </div>
    </div>
  );
}
