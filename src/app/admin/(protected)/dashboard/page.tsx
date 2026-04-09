import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatTime, formatPrice } from "@/lib/utils/format";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export const metadata: Metadata = {
  title: "Dashboard — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const sb = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const [todayRes, weekRes, monthRes, todayListRes] = await Promise.all([
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd)
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
      .gte("start_time", todayStart)
      .lte("start_time", todayEnd)
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

        {/* Danas */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-dark">Termini danas</h2>
            <Link
              href="/admin/termini"
              className="text-[11px] uppercase tracking-wider text-rose hover:underline"
            >
              Svi termini →
            </Link>
          </div>

          {(todayListRes.data?.length ?? 0) === 0 ? (
            <div className="border border-cream bg-white p-8 text-center">
              <p className="text-sm text-light">
                Danas nema zakazanih termina.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-cream bg-white">
              {todayListRes.data!.map((appt, i) => (
                <div
                  key={appt.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    i < todayListRes.data!.length - 1
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
