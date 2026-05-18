import type { Metadata } from "next";
import Link from "next/link";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { AppointmentsRealtime } from "@/components/admin/AppointmentsRealtime";
import { PageHeader } from "@/components/admin/PageHeader";
import { AppointmentRow } from "@/components/admin/AppointmentRow";
import { TerminiToolbar } from "@/components/admin/TerminiToolbar";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Termini — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Range = "danas" | "sedmica" | "mjesec" | "svi";
type StatusFilter = "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";

const RANGE_LABELS: Record<Range, string> = {
  danas: "Danas",
  sedmica: "Sedmica",
  mjesec: "Mjesec",
  svi: "Svi",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  svi: "Svi statusi",
  ceka: "Čeka",
  potvrdjen: "Potvrđen",
  otkazan: "Otkazan",
  zavrsen: "Završen",
};

export default async function AdminTerminiPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: Range; status?: StatusFilter }>;
}) {
  const params = await searchParams;
  const range = params.range ?? "svi";
  const statusFilter = params.status ?? "svi";

  const sb = await createClient();

  let appointmentsQuery = sb
    .from("appointments")
    .select(
      "id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)",
    )
    .order("start_time", { ascending: false });

  const now = new Date();
  if (range === "danas") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfDay(now).toISOString())
      .lte("start_time", endOfDay(now).toISOString());
  } else if (range === "sedmica") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      .lte("start_time", endOfWeek(now, { weekStartsOn: 1 }).toISOString());
  } else if (range === "mjesec") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfMonth(now).toISOString())
      .lte("start_time", endOfMonth(now).toISOString());
  }

  if (statusFilter !== "svi") {
    appointmentsQuery = appointmentsQuery.eq("status", statusFilter);
  }

  // Paraleliziraj: appointments i services nisu međusobno zavisni.
  // Prije: sekvencijalno ~2 round-trip-a do Supabase-a; sad: 1 round-trip.
  const [{ data: appointments }, { data: servicesData }] = await Promise.all([
    appointmentsQuery,
    sb
      .from("services")
      .select("*")
      .eq("bookable", true)
      .eq("active", true)
      .order("order_index"),
  ]);
  const services = servicesData ?? [];

  return (
    <div>
      <AppointmentsRealtime />
      <PageHeader
        title="Termini"
        subtitle={`${appointments?.length ?? 0} zabilježenih`}
        action={<TerminiToolbar services={services} />}
      />

      <div className="p-5 md:p-8">
        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1.5 overflow-x-auto">
            {(["danas", "sedmica", "mjesec", "svi"] as const).map((r) => (
              <FilterLink
                key={r}
                href={`/admin/termini?range=${r}${statusFilter !== "svi" ? `&status=${statusFilter}` : ""}`}
                active={range === r}
                label={RANGE_LABELS[r]}
              />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {(
              ["svi", "ceka", "potvrdjen", "otkazan", "zavrsen"] as const
            ).map((s) => (
              <FilterLink
                key={s}
                href={`/admin/termini?range=${range}${s !== "svi" ? `&status=${s}` : ""}`}
                active={statusFilter === s}
                label={STATUS_LABELS[s]}
              />
            ))}
          </div>
        </div>

        {/* List */}
        {(appointments?.length ?? 0) === 0 ? (
          <div className="border border-cream bg-white p-10 text-center">
            <p className="text-sm text-light">
              Nema termina za izabrani filter.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-cream">
            {appointments!.map((appt) => (
              <AppointmentRow
                key={appt.id}
                appointment={{
                  ...appt,
                  status: appt.status as
                    | "ceka"
                    | "potvrdjen"
                    | "otkazan"
                    | "zavrsen",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap border px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "border-rose bg-rose text-white"
          : "border-cream bg-white text-body hover:border-rose hover:text-rose",
      )}
    >
      {label}
    </Link>
  );
}
