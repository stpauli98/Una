import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { WorkingHoursEditor } from "@/components/admin/WorkingHoursEditor";
import { BlockedDatesManager } from "@/components/admin/BlockedDatesManager";
import { TimeBlocksManager } from "@/components/admin/TimeBlocksManager";
import { BookingRulesEditor } from "@/components/admin/BookingRulesEditor";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { PushNotificationToggle } from "@/components/admin/PushNotificationToggle";
import {
  getCachedWorkingHours,
  getCachedBlockedDates,
  getCachedTimeBlocks,
  getCachedSettings,
} from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Postavke — Admin",
  robots: { index: false, follow: false },
};

// Bez force-dynamic. Svaka sekcija ima svoj cached query sa svojim
// tagom — edit radnog vremena invalidate-uje samo working_hours cache,
// ne settings ili blocked_dates.

export default async function AdminPostavkePage() {
  const [hours, blocked, timeBlocks, settings] = await Promise.all([
    getCachedWorkingHours(),
    getCachedBlockedDates(),
    getCachedTimeBlocks(),
    getCachedSettings(),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const row of settings) {
    settingsMap[row.key] = row.value;
  }

  return (
    <div>
      <PageHeader
        title="Postavke"
        subtitle="Radno vrijeme, blokirani datumi i nalog"
      />

      <div className="space-y-8 p-5 md:p-8">
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Pravila rezervisanja
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite koliko unaprijed i koliko kasno klijenti mogu zakazivati
            termine, te pauzu između termina za pripremu.
          </p>
          <BookingRulesEditor currentSettings={settingsMap} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">Radno vrijeme</h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite radno vrijeme po danima. Ovo se koristi kao fallback
            kada nema postavljenog specifičnog override-a za datum.
          </p>
          <WorkingHoursEditor hours={hours} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani datumi
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Dani kada ste odsutni, praznici, godišnji odmor. Klijenti ne mogu
            zakazati termine u blokiranim datumima.
          </p>
          <BlockedDatesManager dates={blocked} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani intervali (sub-day)
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Blokirajte konkretno vrijeme (npr. 18:00–20:00 u srijedu za
            zubara). Za cijele dane koristite sekciju iznad &quot;Blokirani
            datumi&quot;.
          </p>
          <TimeBlocksManager blocks={timeBlocks} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Obavještenja na uređaju
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Uključi push notifikacije da dobiješ obavještenje čim
            klijent zakaže termin — čak i kad admin panel nije
            otvoren. Najbolje radi kao instalirana PWA (UP Admin) na
            telefon.
          </p>
          <PushNotificationToggle />
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
