import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatTime, formatPrice } from "@/lib/utils/format";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  getSarajevoDayBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";
import { parseBookingSettings } from "@/lib/settings/read";
import { DashboardDayPicker } from "@/components/admin/DashboardDayPicker";

export const metadata: Metadata = {
  title: "Dashboard — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sb = await createClient();

  const now = new Date();
  const todayStr = sarajevoTodayDateStr(now);

  // advance_booking_days iz settings tabele — Una može mijenjati u Postavkama.
  // parseBookingSettings interno fallback-uje na BOOKING_RULES ako ključ
  // nedostaje ili vrijednost neispravna, tako da uvijek dobijamo broj.
  // NAMJERNO sekvencijalan fetch (ne unutar Promise.all ispod): maxDateStr
  // mora biti poznat prije validacije params.date, koja gradi
  // selectedDayBounds za list query.
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
  const maxDateStr = addDaysToDateStr(
    todayStr,
    bookingSettings.advanceBookingDays,
  );

  const params = await searchParams;
  // Validacija + fallback na današnji dan
  let selectedDateStr = todayStr;
  if (params.date) {
    try {
      // getSarajevoDayBounds baca ako neispravan
      getSarajevoDayBounds(params.date);
      selectedDateStr = params.date > maxDateStr ? maxDateStr : params.date;
    } catch {
      selectedDateStr = todayStr;
    }
  }

  // Granice za listu termina (izabrani dan u Sarajevo TZ)
  const selectedDayBounds = getSarajevoDayBounds(selectedDateStr);
  // Granice za "Termini danas" stat card (uvijek stvarni današnji dan)
  const todayBounds = getSarajevoDayBounds(todayStr);

  // Stats sedmica/mjesec ostaju vezani za `now` (stvarni datum, ne izabrani)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const [todayRes, weekRes, monthRes, dayListRes] = await Promise.all([
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("start_time", todayBounds.start)
      .lt("start_time", todayBounds.end)
      .in("status", ["ceka", "potvrdjen"]),
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("start_time", weekStart)
      .lte("start_time", weekEnd)
      .in("status", ["ceka", "potvrdjen"]),
    sb
      .from("appointments")
      .select("id,services(price)")
      .gte("start_time", monthStart)
      .lte("start_time", monthEnd)
      .in("status", ["potvrdjen", "zavrsen"]),
    sb
      .from("appointments")
      .select("id,client_name,client_phone,start_time,status,services(name)")
      .gte("start_time", selectedDayBounds.start)
      .lt("start_time", selectedDayBounds.end)
      .order("start_time"),
  ]);

  const todayCount = todayRes.count ?? 0;
  const weekCount = weekRes.count ?? 0;
  const monthCount = monthRes.data?.length ?? 0;
  const monthRevenue = (monthRes.data ?? []).reduce((sum, a) => {
    return sum + Number(a.services?.price ?? 0);
  }, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Pregled termina i prometa"
      />

      <div className="p-5 md:p-8">
        {/* Domain warning */}
        {(!process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")) && (
          <div className="mb-6 border border-amber-300 bg-amber-50 p-4">
            <p className="text-[13px] font-medium text-amber-800">
              ⚠ Domena nije podešena
            </p>
            <p className="mt-1 text-[12px] text-amber-700">
              NEXT_PUBLIC_SITE_URL je još uvijek na localhost. SEO, sitemap i OG
              slike neće raditi ispravno dok se ne podesi produkcijska domena u
              Vercel environment varijablama.
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Clock}
            label="Termini danas"
            value={todayCount}
          />
          <StatCard
            icon={Calendar}
            label="Ova sedmica"
            value={weekCount}
          />
          <StatCard
            icon={CheckCircle2}
            label="Ovaj mjesec"
            value={monthCount}
          />
          <StatCard
            icon={TrendingUp}
            label="Prihod mjesec"
            value={formatPrice(monthRevenue)}
          />
        </div>

        {/* Termini za izabrani dan */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-dark">Termini</h2>
            <Link
              href="/admin/termini"
              className="text-[11px] uppercase tracking-wider text-rose hover:underline"
            >
              Svi termini →
            </Link>
          </div>

          <div className="mb-3 border border-cream bg-white p-3">
            <DashboardDayPicker
              selectedDateStr={selectedDateStr}
              todayDateStr={todayStr}
              maxDateStr={maxDateStr}
            />
          </div>

          {(dayListRes.data?.length ?? 0) === 0 ? (
            <div className="border border-cream bg-white p-8 text-center">
              <p className="text-sm text-light">
                {selectedDateStr === todayStr
                  ? "Danas nema zakazanih termina."
                  : "Nema zakazanih termina za izabrani dan."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-cream bg-white">
              {dayListRes.data!.map((appt, i) => (
                <div
                  key={appt.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    i < dayListRes.data!.length - 1
                      ? "border-b border-cream"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 shrink-0 text-center">
                      <p className="font-display text-xl text-dark">
                        {formatTime(new Date(appt.start_time))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-dark">
                        {appt.client_name}
                      </p>
                      <p className="text-[11px] text-light">
                        {appt.services?.name} · {appt.client_phone}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={appt.status as "ceka" | "potvrdjen" | "otkazan" | "zavrsen"} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications status */}
        <div className="border border-cream bg-white p-5">
          <h3 className="mb-3 font-display text-base text-dark">
            Status obavještenja
          </h3>
          <div className="space-y-2 text-[12px] text-body">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-green-500" />
              Email (Resend): aktivan — automatski pri novoj rezervaciji
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500" />
              WhatsApp: ručno slanje preko dugmeta u terminima
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
}) {
  return (
    <div className="border border-cream bg-white p-4 md:p-5">
      <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-warm text-rose">
        <Icon size={16} strokeWidth={1.8} />
      </div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-light">
        {label}
      </p>
      <p className="font-display text-2xl text-dark md:text-3xl">{value}</p>
    </div>
  );
}
