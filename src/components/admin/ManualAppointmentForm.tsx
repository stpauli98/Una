"use client";

import { useState, useTransition } from "react";
import { createManualAppointment } from "@/app/admin/(protected)/termini/actions";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  services: Service[];
  onClose: () => void;
};

export function ManualAppointmentForm({ services, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [forceFlag, setForceFlag] = useState(false);

  // Default vrijeme: sutra 17:00 (lokalno)
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-cream bg-white">
        <div className="border-b border-cream px-5 py-4">
          <h2 className="font-display text-xl text-dark">Dodaj termin</h2>
          <p className="mt-1 text-[11px] text-light">
            Ručni unos termina (telefonska rezervacija). Termin će biti odmah
            potvrđen.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setFieldErrors({});
            setConflictWarning(null);

            const fd = new FormData(e.currentTarget);
            const localStr = String(fd.get("start_time_local") ?? "");
            if (localStr) {
              const localDate = new Date(localStr);
              fd.set("start_time", localDate.toISOString());
            }
            if (forceFlag) fd.set("force", "true");

            startTransition(async () => {
              const result = await createManualAppointment(fd);
              if (result.ok) {
                onClose();
                return;
              }
              if (result.conflict) {
                setConflictWarning(result.error);
                return;
              }
              setError(result.error);
              setFieldErrors(result.fieldErrors ?? {});
            });
          }}
          className="space-y-4 px-5 py-5"
        >
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Usluga
            </label>
            <select
              name="service_id"
              required
              defaultValue={services[0]?.id ?? ""}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min ?? "—"}min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Ime klijenta
            </label>
            <input
              name="client_name"
              required
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
            {fieldErrors.client_name && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.client_name[0]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Telefon
            </label>
            <input
              name="client_phone"
              required
              placeholder="065 123 456 ili +49 151 23456789"
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
            {fieldErrors.client_phone && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.client_phone[0]}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Email (opciono)
            </label>
            <input
              name="client_email"
              type="email"
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Datum i vrijeme
            </label>
            <input
              name="start_time_local"
              type="datetime-local"
              required
              defaultValue={defaultStart}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Napomena (opciono)
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full resize-none border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </div>

          {conflictWarning && (
            <div className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-2 font-medium">{conflictWarning}</p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={forceFlag}
                  onChange={(e) => setForceFlag(e.target.checked)}
                  className="accent-rose"
                />
                <span>Svejedno ubaci (ignoriši konflikt)</span>
              </label>
            </div>
          )}

          {error && !conflictWarning && (
            <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 border border-cream bg-white py-2.5 text-[11px] uppercase tracking-wider hover:border-rose cursor-pointer"
            >
              Otkaži
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Spremam..." : "Sačuvaj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
