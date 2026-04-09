import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { WorkingHoursEditor } from "@/components/admin/WorkingHoursEditor";
import { BlockedDatesManager } from "@/components/admin/BlockedDatesManager";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Postavke — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPostavkePage() {
  const sb = await createClient();

  const [hoursRes, blockedRes] = await Promise.all([
    sb.from("working_hours").select("*"),
    sb.from("blocked_dates").select("*").order("date_from"),
  ]);

  return (
    <div>
      <PageHeader
        title="Postavke"
        subtitle="Radno vrijeme, blokirani datumi i nalog"
      />

      <div className="space-y-8 p-5 md:p-8">
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">Radno vrijeme</h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite radno vrijeme po danima. Ovo se koristi kao fallback
            kada nema postavljenog specifičnog override-a za datum.
          </p>
          <WorkingHoursEditor hours={hoursRes.data ?? []} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani datumi
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Dani kada ste odsutni, praznici, godišnji odmor. Klijenti ne mogu
            zakazati termine u blokiranim datumima.
          </p>
          <BlockedDatesManager dates={blockedRes.data ?? []} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Promjena lozinke
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Preporučuje se jaka lozinka od najmanje 8 karaktera.
          </p>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
