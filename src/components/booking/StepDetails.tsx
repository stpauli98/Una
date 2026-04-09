"use client";

import { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { createAppointment } from "@/app/zakazi/actions";
import { formatDate, formatTime } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  service: Service;
  startTimeIso: string;
  onBack: () => void;
};

export function StepDetails({ service, startTimeIso, onBack }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const startDate = new Date(startTimeIso);

  return (
    <div>
      <div className="mb-8 text-center">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-light transition-colors hover:text-rose cursor-pointer"
        >
          <ChevronLeft size={12} /> Promijeni termin
        </button>
        <h2 className="mb-1 font-display text-3xl font-light text-dark md:text-4xl">
          Vaši podaci
        </h2>
        <p className="text-[13px] text-light">
          Popunite formu i rezervacija će biti zabilježena.
        </p>
      </div>

      {/* Summary card */}
      <div className="mx-auto mb-6 max-w-[520px] border border-cream bg-warm p-5">
        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-rose">
          Vaša rezervacija
        </p>
        <p className="font-display text-xl text-dark">{service.name}</p>
        <p className="mt-1 text-sm text-body">
          {formatDate(startDate)} · {formatTime(startDate)}
        </p>
      </div>

      <form
        action={(formData) => {
          setError(null);
          setFieldErrors({});
          formData.set("service_id", String(service.id));
          formData.set("start_time", startTimeIso);
          startTransition(async () => {
            const result = await createAppointment(formData);
            if (!result.ok) {
              setError(result.error);
              setFieldErrors(result.fieldErrors ?? {});
            }
            // On success, server action redirects — nothing to do here
          });
        }}
        className="mx-auto max-w-[520px] border border-cream bg-white p-6 md:p-7"
      >
        <div className="mb-4">
          <label
            htmlFor="client_name"
            className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
          >
            Ime i prezime
          </label>
          <input
            id="client_name"
            name="client_name"
            type="text"
            required
            autoComplete="name"
            disabled={pending}
            className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus:outline-none disabled:opacity-60"
            placeholder="Npr. Marija Petrović"
          />
          {fieldErrors.client_name && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.client_name[0]}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="client_phone"
            className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
          >
            Telefon
          </label>
          <input
            id="client_phone"
            name="client_phone"
            type="tel"
            required
            autoComplete="tel"
            disabled={pending}
            className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus:outline-none disabled:opacity-60"
            placeholder="065 123 456"
          />
          {fieldErrors.client_phone && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.client_phone[0]}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="client_email"
            className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
          >
            Email (opciono)
          </label>
          <input
            id="client_email"
            name="client_email"
            type="email"
            autoComplete="email"
            disabled={pending}
            className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus:outline-none disabled:opacity-60"
            placeholder="vas@email.com"
          />
          {fieldErrors.client_email && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.client_email[0]}
            </p>
          )}
        </div>

        <div className="mb-5">
          <label
            htmlFor="notes"
            className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
          >
            Napomena (opciono)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            disabled={pending}
            className="w-full resize-none border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus:outline-none disabled:opacity-60"
            placeholder="Alergije, posebne želje, inspiracija..."
          />
          {fieldErrors.notes && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.notes[0]}</p>
          )}
        </div>

        <div className="mb-5">
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-body">
            <input
              type="checkbox"
              name="consent"
              value="true"
              required
              disabled={pending}
              className="mt-0.5 accent-rose"
            />
            <span>
              Saglasan/na sam da se moji podaci koriste isključivo za potrebe
              zakazivanja i potvrđivanja termina.
            </span>
          </label>
          {fieldErrors.consent && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.consent[0]}</p>
          )}
        </div>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-rose py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Šaljem..." : "Potvrdi rezervaciju"}
        </button>
      </form>
    </div>
  );
}
