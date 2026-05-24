"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatTime } from "@/lib/utils/format";
import { useLiveNow } from "@/lib/hooks/use-live-now";
import { sarajevoDateStr } from "@/lib/utils/day-bounds";
import type { AppointmentStatus } from "@/lib/utils/wa-messages";

type Props = {
  appointment: {
    id: number;
    client_name: string;
    client_phone: string;
    start_time: string;
    status: AppointmentStatus;
    services: { name: string } | null;
  };
  /** True ako ovo nije zadnji red u listi — dodaje border-bottom. */
  showDivider: boolean;
};

/**
 * Dashboard summary row za jedan termin. Wrapper Link na
 * /admin/termini?date=<dan>&focus=<id> za skok + Potvrdi flow
 * (vidi FocusAppointment.tsx).
 *
 * Past indikator: `opacity-60` + "prošlo" tag za past termine
 * sa status='ceka' ili 'potvrdjen' — match-uje UX iz AppointmentRow
 * (Termini tab). Re-render-uje se svake minute preko useLiveNow.
 */
export function DashboardAppointmentRow({ appointment, showDivider }: Props) {
  const now = useLiveNow();
  const start = new Date(appointment.start_time);
  const isPast = start.getTime() < now;
  const needsStatusUpdate =
    isPast &&
    (appointment.status === "ceka" || appointment.status === "potvrdjen");

  const terminiHref = `/admin/termini?date=${sarajevoDateStr(start)}&focus=${appointment.id}`;

  return (
    <Link
      href={terminiHref}
      aria-label={`Otvori termin ${appointment.client_name} u ${formatTime(start)} u Termini tabu`}
      className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-warm focus-visible:bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
        showDivider ? "border-b border-cream" : ""
      } ${isPast ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 shrink-0 text-center">
          <p className="font-display text-xl text-dark">{formatTime(start)}</p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[13px] font-medium text-dark">
              {appointment.client_name}
            </p>
            {needsStatusUpdate && (
              <span className="text-[10px] uppercase tracking-wider text-light">
                prošlo
              </span>
            )}
          </div>
          <p className="text-[11px] text-light">
            {appointment.services?.name} · {appointment.client_phone}
          </p>
        </div>
      </div>
      <StatusBadge status={appointment.status} />
    </Link>
  );
}
