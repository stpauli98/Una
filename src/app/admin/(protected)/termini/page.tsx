import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
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
import { AdminPrefsPersister } from "@/components/admin/AdminPrefsPersister";
import {
  TERMINI_PREFS_COOKIE,
  parseTerminiPrefs,
} from "@/lib/utils/admin-prefs";
import { PageHeader } from "@/components/admin/PageHeader";
import { AppointmentRow } from "@/components/admin/AppointmentRow";
import { TerminiToolbar } from "@/components/admin/TerminiToolbar";
import { AdminDayPicker } from "@/components/admin/AdminDayPicker";
import { TerminiSortToggle } from "@/components/admin/TerminiSortToggle";
import { TerminiStatusFilter } from "@/components/admin/TerminiStatusFilter";
import { countByStatus } from "@/lib/utils/status-counts";
import {
  getSarajevoDayBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
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

type Range = "danas" | "sedmica" | "mjesec" | "svi";
type StatusFilter = "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";
type Sort = "asc" | "desc";

const RANGE_LABELS: Record<Range, string> = {
  danas: "Danas",
  sedmica: "Sedmica",
  mjesec: "Mjesec",
  svi: "Svi",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRange(v: string | undefined): v is Range {
  return v === "danas" || v === "sedmica" || v === "mjesec" || v === "svi";
}
function isStatus(v: string | undefined): v is StatusFilter {
  return (
    v === "svi" ||
    v === "ceka" ||
    v === "potvrdjen" ||
    v === "otkazan" ||
    v === "zavrsen"
  );
}

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
  // Cookie fallback: ako URL nema nijedan filter param, učitaj zadnje izbore
  // iz cookie-ja. URL pobjeđuje cookie kad oboje postoje.
  const cookieStore = await cookies();
  const cookiePrefs = parseTerminiPrefs(
    cookieStore.get(TERMINI_PREFS_COOKIE)?.value,
  );
  const hasUrlFilter =
    !!params.date || !!params.range || !!params.status || !!params.sort;
  const effective = hasUrlFilter ? params : cookiePrefs;

  const dateParam =
    effective.date && ISO_DATE_RE.test(effective.date)
      ? effective.date
      : undefined;
  // date i range su međusobno isključivi — date pobjeđuje ako je zadan.
  const rangeParam: Range = dateParam
    ? "svi"
    : isRange(effective.range)
      ? effective.range
      : "svi";
  const statusFilter: StatusFilter = isStatus(effective.status)
    ? effective.status
    : "svi";
  // Default sort: ASC za single-day (date ili range=danas), DESC za multi-day.
  const isSingleDay = !!dateParam || rangeParam === "danas";
  const defaultSort: Sort = isSingleDay ? "asc" : "desc";
  const sort: Sort =
    effective.sort === "asc" || effective.sort === "desc"
      ? effective.sort
      : defaultSort;

  const sb = await createClient();
  const now = new Date();
  const todayStr = sarajevoTodayDateStr(now);

  // maxDateStr za day picker: 90 dana unaprijed (po BOOKING_RULES) — ali
  // čitamo iz settings tabele za živo. Settings query je keširan u layout-u
  // ali ovdje radimo direktan query da uhvatimo svježu vrijednost.
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
  const maxDateStr = addDaysToDateStr(
    todayStr,
    bookingSettings.advanceBookingDays,
  );

  // Query construction
  let appointmentsQuery = sb
    .from("appointments")
    .select(
      "id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)",
    )
    .order("start_time", { ascending: sort === "asc" });

  if (dateParam) {
    const bounds = getSarajevoDayBounds(dateParam);
    appointmentsQuery = appointmentsQuery
      .gte("start_time", bounds.start)
      .lt("start_time", bounds.end);
  } else if (rangeParam === "danas") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfDay(now).toISOString())
      .lte("start_time", endOfDay(now).toISOString());
  } else if (rangeParam === "sedmica") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      .lte("start_time", endOfWeek(now, { weekStartsOn: 1 }).toISOString());
  } else if (rangeParam === "mjesec") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfMonth(now).toISOString())
      .lte("start_time", endOfMonth(now).toISOString());
  }

  if (statusFilter !== "svi") {
    appointmentsQuery = appointmentsQuery.eq("status", statusFilter);
  }

  // Separate query za counts — ide preko ISTOG date/range filtera ali BEZ
  // status restrikcije, tako da dropdown vidi broj svih statusa unutar
  // trenutnog opsega (npr. "Čeka (3)" + "Potvrđen (8)" istovremeno čak
  // i kad je trenutni filter "ceka").
  let countsQuery = sb.from("appointments").select("status");
  if (dateParam) {
    const bounds = getSarajevoDayBounds(dateParam);
    countsQuery = countsQuery
      .gte("start_time", bounds.start)
      .lt("start_time", bounds.end);
  } else if (rangeParam === "danas") {
    countsQuery = countsQuery
      .gte("start_time", startOfDay(now).toISOString())
      .lte("start_time", endOfDay(now).toISOString());
  } else if (rangeParam === "sedmica") {
    countsQuery = countsQuery
      .gte("start_time", startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      .lte("start_time", endOfWeek(now, { weekStartsOn: 1 }).toISOString());
  } else if (rangeParam === "mjesec") {
    countsQuery = countsQuery
      .gte("start_time", startOfMonth(now).toISOString())
      .lte("start_time", endOfMonth(now).toISOString());
  }

  const [
    { data: appointments },
    { data: servicesData },
    { data: countsData },
  ] = await Promise.all([
    appointmentsQuery,
    sb
      .from("services")
      .select("*")
      .eq("bookable", true)
      .eq("active", true)
      .order("order_index"),
    countsQuery,
  ]);
  const services = servicesData ?? [];
  const statusCounts = countByStatus(countsData ?? []);

  const groups = groupAppointmentsByDay(appointments ?? []);
  const multiDay = groups.length > 1;

  // URL helper za preset chip i status chip — preserve sort, ne date ako se preset klika
  const buildPresetHref = (r: Range, s: StatusFilter): string => {
    const sp = new URLSearchParams();
    sp.set("range", r);
    if (s !== "svi") sp.set("status", s);
    if (sort !== defaultSort) sp.set("sort", sort);
    return `/admin/termini?${sp.toString()}`;
  };

  // Preserve params za AdminDayPicker (date promjena čuva status + sort).
  // KORISTI derived `sort` i `statusFilter` (uključuju cookie fallback), ne raw
  // `params.X` — inače kad cookie restore-uje izbore a URL je prazan, day picker
  // klik bi izgubio non-default sort.
  const dayPickerPreserve: Record<string, string | undefined> = {
    status: statusFilter !== "svi" ? statusFilter : undefined,
    sort: sort !== defaultSort ? sort : undefined,
  };

  // Preserve za sort toggle (čuva range/date/status)
  const sortPreserve: Record<string, string | undefined> = {
    range: dateParam ? undefined : rangeParam !== "svi" ? rangeParam : undefined,
    date: dateParam,
    status: statusFilter !== "svi" ? statusFilter : undefined,
  };

  // Preserve za status filter (čuva range/date/sort)
  const statusPreserve: Record<string, string | undefined> = {
    range: dateParam ? undefined : rangeParam !== "svi" ? rangeParam : undefined,
    date: dateParam,
    sort: sort !== defaultSort ? sort : undefined,
  };

  return (
    <div>
      <AppointmentsRealtime />
      <AdminPrefsPersister />
      <PageHeader
        title="Termini"
        subtitle={`${appointments?.length ?? 0} zabilježenih`}
        action={<TerminiToolbar services={services} />}
      />

      <div className="p-5 md:p-8">
        {/* Day picker — uvijek vidljiv, klik mijenja konkretan datum */}
        <div className="mb-4 border border-cream bg-white p-3">
          <AdminDayPicker
            selectedDateStr={dateParam ?? todayStr}
            todayDateStr={todayStr}
            maxDateStr={maxDateStr}
            basePath="/admin/termini"
            preserveParams={dayPickerPreserve}
          />
        </div>

        {/* Filteri */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1.5 overflow-x-auto">
            {(["danas", "sedmica", "mjesec", "svi"] as const).map((r) => (
              <FilterLink
                key={r}
                href={buildPresetHref(r, statusFilter)}
                active={!dateParam && rangeParam === r}
                label={RANGE_LABELS[r]}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <TerminiStatusFilter
              value={statusFilter}
              counts={statusCounts}
              basePath="/admin/termini"
              preserveParams={statusPreserve}
            />
            <TerminiSortToggle
              sort={sort}
              basePath="/admin/termini"
              preserveParams={sortPreserve}
            />
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
