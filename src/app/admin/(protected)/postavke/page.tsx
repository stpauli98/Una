import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { WorkingHoursEditor } from "@/components/admin/WorkingHoursEditor";
import { BlockedDatesManager } from "@/components/admin/BlockedDatesManager";
import { TimeBlocksManager } from "@/components/admin/TimeBlocksManager";
import { BookingRulesEditor } from "@/components/admin/BookingRulesEditor";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { PushNotificationToggle } from "@/components/admin/PushNotificationToggle";
import { CsvExportButton } from "@/components/admin/CsvExportButton";
import { EmailNotificationStatus } from "@/components/admin/EmailNotificationStatus";
import { getEmailNotificationConfig } from "@/app/admin/(protected)/postavke/email-actions";
import {
  getCachedWorkingHours,
  getCachedBlockedDates,
  getCachedTimeBlocks,
  getCachedSettings,
} from "@/lib/cache/cached-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/utils/tz";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";

const BOOKING_RULE_KEYS = [
  "min_hours_before",
  "advance_booking_days",
  "cancellation_hours",
  "break_between_min",
] as const;

/**
 * Vraća sortiranu (descending) listu godina za koje IMA bar 1 termin.
 * Računa preko min/max start_time u Sarajevo TZ.
 */
async function getAppointmentYears(): Promise<number[]> {
  const sb = createAdminClient();
  const [minRes, maxRes] = await Promise.all([
    sb
      .from("appointments")
      .select("start_time")
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb
      .from("appointments")
      .select("start_time")
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!minRes.data || !maxRes.data) return [];
  const minYear = Number(
    formatInTimeZone(new Date(minRes.data.start_time), TZ, "yyyy"),
  );
  const maxYear = Number(
    formatInTimeZone(new Date(maxRes.data.start_time), TZ, "yyyy"),
  );
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  return years;
}

/**
 * Vraća najveći ISO timestamp iz array-a, ili null ako je prazan.
 * Koristi se za "Zadnje izmijenjeno" indikator po sekciji.
 */
function maxTimestamp(
  rows: Array<{ updated_at?: string | null; created_at?: string | null }>,
  field: "updated_at" | "created_at",
): string | null {
  let max: string | null = null;
  for (const row of rows) {
    const v = row[field];
    if (v && (max === null || v > max)) max = v;
  }
  return max;
}

function formatMetaTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${formatShortDate(d)} ${formatTime(d)}`;
}

function SectionMeta({
  label,
  timestamp,
}: {
  label: string;
  timestamp: string | null;
}) {
  if (!timestamp) return null;
  return (
    <p className="mb-3 text-[10px] uppercase tracking-wider text-light">
      {label}: {formatMetaTimestamp(timestamp)}
    </p>
  );
}

export const metadata: Metadata = {
  title: "Postavke — Admin",
  robots: { index: false, follow: false },
};

// Bez force-dynamic. Svaka sekcija ima svoj cached query sa svojim
// tagom — edit radnog vremena invalidate-uje samo working_hours cache,
// ne settings ili blocked_dates.

export default async function AdminPostavkePage() {
  const [hours, blocked, timeBlocks, settings, exportYears, emailConfig] =
    await Promise.all([
      getCachedWorkingHours(),
      getCachedBlockedDates(),
      getCachedTimeBlocks(),
      getCachedSettings(),
      getAppointmentYears(),
      getEmailNotificationConfig(),
    ]);

  const settingsMap: Record<string, string> = {};
  for (const row of settings) {
    settingsMap[row.key] = row.value;
  }

  // "Zadnje izmijenjeno" timestamps po sekciji.
  // - Booking rules: MAX(updated_at) samo onih ključeva koje BookingRulesEditor
  //   stvarno koristi (ignorišemo eventualne druge settings ključeve).
  // - Blocked dates / Time blocks: MAX(created_at) jer te tabele pretežno
  //   imaju INSERT-e i DELETE-ove (rijetko UPDATE) — "zadnje dodato" je
  //   semantički točniji label.
  const bookingRulesLastUpdated = maxTimestamp(
    settings.filter((s) =>
      (BOOKING_RULE_KEYS as readonly string[]).includes(s.key),
    ),
    "updated_at",
  );
  const blockedDatesLastAdded = maxTimestamp(blocked, "created_at");
  const timeBlocksLastAdded = maxTimestamp(timeBlocks, "created_at");

  return (
    <div>
      <PageHeader
        title="Postavke"
        subtitle="Radno vrijeme, blokirani datumi i nalog"
      />

      <div className="space-y-8 p-5 md:p-8">
        <CollapsibleSection
          title="Pravila rezervisanja"
          description="Podesite koliko unaprijed i koliko kasno klijenti mogu zakazivati termine, te pauzu između termina za pripremu."
          meta={
            <SectionMeta
              label="Zadnje izmijenjeno"
              timestamp={bookingRulesLastUpdated}
            />
          }
        >
          <BookingRulesEditor currentSettings={settingsMap} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Radno vrijeme"
          description="Podesite radno vrijeme po danima. Ovo se koristi kao fallback kada nema postavljenog specifičnog override-a za datum."
        >
          <WorkingHoursEditor hours={hours} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Blokirani datumi"
          description="Dani kada ste odsutni, praznici, godišnji odmor. Klijenti ne mogu zakazati termine u blokiranim datumima."
          meta={
            <SectionMeta
              label="Zadnje dodato"
              timestamp={blockedDatesLastAdded}
            />
          }
        >
          <BlockedDatesManager dates={blocked} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Blokirani intervali (sub-day)"
          description='Blokirajte konkretno vrijeme (npr. 18:00–20:00 u srijedu za zubara). Za cijele dane koristite sekciju iznad "Blokirani datumi".'
          meta={
            <SectionMeta
              label="Zadnje dodato"
              timestamp={timeBlocksLastAdded}
            />
          }
        >
          <TimeBlocksManager blocks={timeBlocks} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Obavještenja na uređaju"
          description="Uključi push notifikacije da dobiješ obavještenje čim klijent zakaže termin — čak i kad admin panel nije otvoren. Najbolje radi kao instalirana PWA (UP Admin) na telefon."
        >
          <PushNotificationToggle />
        </CollapsibleSection>

        <CollapsibleSection
          title="Email obavještenja"
          description="Pri svakoj novoj rezervaciji šalje email Uni preko Resend servisa. Konfiguracija ide kroz Vercel environment variables. Dugme 'Pošalji test' šalje primjer email-a sa istim formatom kao prave rezervacije."
        >
          <EmailNotificationStatus
            configured={emailConfig.configured}
            recipientPreview={emailConfig.recipientPreview}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Export podataka"
          description="Preuzmi sve termine u CSV formatu za backup ili porezni izvještaj. Otvara se u Excel-u i LibreOffice Calc-u (semicolon separator, UTF-8 sa BOM-om)."
        >
          <CsvExportButton availableYears={exportYears} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Promjena lozinke"
          description="Preporučuje se jaka lozinka od najmanje 8 karaktera."
        >
          <ChangePasswordForm />
        </CollapsibleSection>
      </div>
    </div>
  );
}
