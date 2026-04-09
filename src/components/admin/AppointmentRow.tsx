"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Check, X, CheckCircle2 } from "lucide-react";
import {
  confirmAppointment,
  cancelAppointment,
  markCompleted,
} from "@/app/admin/(protected)/termini/actions";
import { StatusBadge } from "./StatusBadge";
import { formatDate, formatTime } from "@/lib/utils/format";
import { waLink } from "@/lib/utils/wa";
import {
  buildAppointmentWaMessage,
  waButtonLabel,
  type AppointmentStatus,
} from "@/lib/utils/wa-messages";

type Appointment = {
  id: number;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  start_time: string;
  status: AppointmentStatus;
  notes: string | null;
  services: { name: string } | null;
};

export function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startDate = new Date(appointment.start_time);
  const serviceName = appointment.services?.name ?? "—";

  const waMessage = buildAppointmentWaMessage({
    clientName: appointment.client_name,
    serviceName,
    startTime: startDate,
    status: appointment.status,
  });
  const waLabel = waButtonLabel(appointment.status);

  const handle = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
    });
  };

  return (
    <div className="border-b border-cream bg-white p-5 last:border-b-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <p className="font-display text-lg text-dark">
              {formatDate(startDate)} · {formatTime(startDate)}
            </p>
            <StatusBadge status={appointment.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-body">
            <span className="font-medium text-dark">
              {appointment.client_name}
            </span>
            <span>·</span>
            <span>{serviceName}</span>
            <span>·</span>
            <a
              href={`tel:${appointment.client_phone}`}
              className="text-rose hover:underline"
            >
              {appointment.client_phone}
            </a>
          </div>
          {appointment.notes && (
            <p className="mt-2 text-[12px] italic text-light">
              “{appointment.notes}”
            </p>
          )}
          {error && (
            <p className="mt-2 text-[11px] text-red-600">{error}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <a
            href={waLink(appointment.client_phone, waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-green-600 px-3 py-2 text-[10px] uppercase tracking-wider text-white hover:bg-green-700"
          >
            <MessageCircle size={12} />
            {waLabel}
          </a>
          {appointment.status === "ceka" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handle(() => confirmAppointment(appointment.id))}
              className="inline-flex items-center gap-1 bg-rose px-3 py-2 text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
            >
              <Check size={12} />
              Potvrdi
            </button>
          )}
          {appointment.status === "potvrdjen" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handle(() => markCompleted(appointment.id))}
              className="inline-flex items-center gap-1 border border-cream bg-white px-3 py-2 text-[10px] uppercase tracking-wider text-dark transition-colors hover:border-rose hover:text-rose disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 size={12} />
              Završen
            </button>
          )}
          {(appointment.status === "ceka" ||
            appointment.status === "potvrdjen") && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handle(() => cancelAppointment(appointment.id))}
              className="inline-flex items-center gap-1 border border-red-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wider text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 cursor-pointer"
            >
              <X size={12} />
              Otkaži
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
