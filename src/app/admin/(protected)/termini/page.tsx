import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppointmentsRealtime } from "@/components/admin/AppointmentsRealtime";
import { AdminPrefsPersister } from "@/components/admin/AdminPrefsPersister";
import {
  TERMINI_PREFS_COOKIE,
  parseTerminiPrefs,
  resolveTerminiPrefs,
} from "@/lib/utils/admin-prefs";
import { PageHeader } from "@/components/admin/PageHeader";
import { AppointmentRow } from "@/components/admin/AppointmentRow";
import { TerminiToolbar } from "@/components/admin/TerminiToolbar";
import { AdminDayPicker } from "@/components/admin/AdminDayPicker";
import { TerminiSortToggle } from "@/components/admin/TerminiSortToggle";
import { TerminiStatusFilter } from "@/components/admin/TerminiStatusFilter";
import { countByStatus } from "@/lib/utils/status-counts";
import {
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
import { buildAppointmentsBoundsFilter } from "@/lib/utils/termini-filters";
import { parseBookingSettings } from "@/lib/settings/read";
import { groupAppointmentsByDay } from "@/lib/utils/group-by-day";
import { formatDate } from "@/lib/utils/format";
import { parseDateSarajevo } from "@/lib/utils/tz";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Termini — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const APPOINTMENTS_LIMIT = 500;

type Range = "danas" | "sedmica" | "mjesec" | "svi";
type StatusFilter = "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";

const RANGE_LABELS: Record<Range, string> = {
  danas: "Danas",
  sedmica: "Sedmica",
  mjesec: "Mjesec",
  svi: "Svi",
};

export default async function AdminTerminiPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    status?: string;
    date?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookiePrefs = parseTerminiPrefs(
    cookieStore.get(TERMINI_PREFS_COOKIE)?.value,
  );

  const resolved = resolveTerminiPrefs(params, cookiePrefs);
  const bounds = buildAppointmentsBoundsFilter(resolved);

  const sb = await createClient();
  const now = new Date();
  const todayStr = sarajevoTodayDateStr(now);

  // maxDateStr za day picker
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
  const maxDateStr = addDaysToDateStr(
    todayStr,
    bookingSettings.advanceBookingDays,
  );

  // Appointments query (sortiran, limit)
  let appointmentsQuery = sb
    .from("appointments")
    .select(
      "id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)",
    )
    .order("start_time", { ascending: resolved.sort === "asc" })
    .limit(APPOINTMENTS_LIMIT);
  if (bounds.kind === "bounded") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", bounds.gte)
      .lt("start_time", bounds.lt);
  }
  if (resolved.status !== "svi") {
    appointmentsQuery = appointmentsQuery.eq("status", resolved.status);
  }

  // Counts query — bez status filtera (dropdown pokazuje sve statuse)
  let countsQuery = sb.from("appointments").select("status");
  if (bounds.kind === "bounded") {
    countsQuery = countsQuery
      .gte("start_time", bounds.gte)
      .lt("start_time", bounds.lt);
  }

  // Total count query — head: true (brz, samo count)
  let totalCountQuery = sb
    .from("appointments")
    .select("id", { count: "exact", head: true });
  if (bounds.kind === "bounded") {
    totalCountQuery = totalCountQuery
      .gte("start_time", bounds.gte)
      .lt("start_time", bounds.lt);
  }
  if (resolved.status !== "svi") {
    totalCountQuery = totalCountQuery.eq("status", resolved.status);
  }

  const [
    { data: appointments },
    { data: servicesData },
    { data: countsData },
    { count: totalMatching },
  ] = await Promise.all([
    appointmentsQuery,
    sb
      .from("services")
      .select("*")
      .eq("bookable", true)
      .eq("active", true)
      .order("order_index"),
    countsQuery,
    totalCountQuery,
  ]);
  const services = servicesData ?? [];
  const statusCounts = countByStatus(countsData ?? []);

  const groups = groupAppointmentsByDay(appointments ?? []);
  const multiDay = groups.length > 1;

  // URL helpers — koriste resolved.* (uključuje cookie fallback)
  const buildPresetHref = (r: Range, s: StatusFilter): string => {
    const sp = new URLSearchParams();
    sp.set("range", r);
    if (s !== "svi") sp.set("status", s);
    if (!resolved.isDefaultSort) sp.set("sort", resolved.sort);
    return `/admin/termini?${sp.toString()}`;
  };

  const dayPickerPreserve: Record<string, string | undefined> = {
    status: resolved.status !== "svi" ? resolved.status : undefined,
    sort: !resolved.isDefaultSort ? resolved.sort : undefined,
  };

  const sortPreserve: Record<string, string | undefined> = {
    range: resolved.date
      ? undefined
      : resolved.range !== "svi"
        ? resolved.range
        : undefined,
    date: resolved.date,
    status: resolved.status !== "svi" ? resolved.status : undefined,
  };

  const statusPreserve: Record<string, string | undefined> = {
    range: resolved.date
      ? undefined
      : resolved.range !== "svi"
        ? resolved.range
        : undefined,
    date: resolved.date,
    sort: !resolved.isDefaultSort ? resolved.sort : undefined,
  };

  return (
    <div>
      <AppointmentsRealtime />
      <AdminPrefsPersister />
      <PageHeader
        title="Termini"
        subtitle={`${totalMatching ?? appointments?.length ?? 0} zabilježenih`}
        action={<TerminiToolbar services={services} />}
      />

      <div className="p-5 md:p-8">
        <div className="mb-4 border border-cream bg-white p-3">
          <AdminDayPicker
            selectedDateStr={resolved.date ?? todayStr}
            todayDateStr={todayStr}
            maxDateStr={maxDateStr}
            basePath="/admin/termini"
            preserveParams={dayPickerPreserve}
          />
        </div>

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1.5 overflow-x-auto">
            {(["danas", "sedmica", "mjesec", "svi"] as const).map((r) => (
              <FilterLink
                key={r}
                href={buildPresetHref(r, resolved.status)}
                active={!resolved.date && resolved.range === r}
                label={RANGE_LABELS[r]}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <TerminiStatusFilter
              value={resolved.status}
              counts={statusCounts}
              basePath="/admin/termini"
              preserveParams={statusPreserve}
            />
            <TerminiSortToggle
              sort={resolved.sort}
              basePath="/admin/termini"
              preserveParams={sortPreserve}
            />
          </div>
        </div>

        {(appointments?.length ?? 0) === 0 ? (
          <div className="border border-cream bg-white p-10 text-center">
            <p className="text-sm text-light">
              Nema termina za izabrani filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.dateStr}>
                {multiDay && <DateGroupHeader dateStr={group.dateStr} />}
                <div className="overflow-hidden border border-cream">
                  {group.appointments.map((appt) => (
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
              </div>
            ))}
          </div>
        )}

        {totalMatching !== null && totalMatching > APPOINTMENTS_LIMIT && (
          <p className="mt-4 border border-cream bg-white p-3 text-center text-xs text-light">
            Prikazano {APPOINTMENTS_LIMIT} od {totalMatching} termina. Suzite
            filter za prikaz preostalih.
          </p>
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

function DateGroupHeader({ dateStr }: { dateStr: string }) {
  return (
    <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-light first-letter:uppercase">
      {formatDate(parseDateSarajevo(dateStr))}
    </p>
  );
}
