"use client";

import { useState, useEffect, useTransition } from "react";
import { format, addDays } from "date-fns";
import { createManualAppointment } from "@/app/admin/(protected)/termini/actions";
import { formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Slot = { start: string; end: string };

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

  // Controlled state za slot fetching
  const [serviceId, setServiceId] = useState<string>(
    services[0]?.id != null ? String(services[0].id) : "",
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    format(addDays(new Date(), 1), "yyyy-MM-dd"),
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [customMode, setCustomMode] = useState(false);

  // Fetch slots kad se serviceId ili datum promijeni
  useEffect(() => {
    if (!serviceId || !selectedDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot("");
    setCustomMode(false);

    fetch(
      `/api/availability?date=${selectedDate}&service_id=${serviceId}&admin=true`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots ?? []);
          setSlotsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setSlotsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, selectedDate]);

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

            if (customMode) {
              const customDate = String(fd.get("custom_date") ?? "");
              const customTime = String(fd.get("custom_time") ?? "");
              if (customDate && customTime) {
                fd.set(
                  "start_time",
                  new Date(`${customDate}T${customTime}:00`).toISOString(),
                );
              }
            } else if (selectedSlot) {
              fd.set("start_time", selectedSlot);
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
          {/* Usluga (controlled) */}
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Usluga
            </label>
            <select
              name="service_id"
              required
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min ?? "—"}min)
                </option>
              ))}
            </select>
          </div>

          {/* Klijent */}
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Ime klijenta
            </span>
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
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Telefon
            </span>
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
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Email (opciono)
            </span>
            <input
              name="client_email"
              type="email"
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </label>

          {/* Datum */}
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Datum
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </div>

          {/* Slot grid ili custom input */}
          {!customMode && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-dark">
                  Slobodni termini
                </span>
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="text-[10px] text-rose underline-offset-2 hover:underline cursor-pointer"
                >
                  Prilagođeno vrijeme
                </button>
              </div>

              {slotsLoading ? (
                <p className="py-4 text-center text-xs text-light">
                  Učitavanje...
                </p>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {slots.map((slot) => {
                    const active = selectedSlot === slot.start;
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot.start)}
                        className={cn(
                          "border px-2 py-2 text-xs transition-colors cursor-pointer",
                          active
                            ? "border-rose bg-rose text-white"
                            : "border-cream bg-white text-dark hover:border-rose",
                        )}
                      >
                        {formatTime(new Date(slot.start))}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-cream bg-warm p-4 text-center">
                  <p className="text-xs text-light">
                    Nema slobodnih termina za ovaj dan.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCustomMode(true)}
                    className="mt-2 text-[10px] text-rose underline-offset-2 hover:underline cursor-pointer"
                  >
                    Unesi prilagođeno vrijeme
                  </button>
                </div>
              )}

              {selectedSlot && (
                <p className="mt-2 text-xs text-body">
                  Izabrano:{" "}
                  <span className="font-medium text-dark">
                    {formatTime(new Date(selectedSlot))}
                  </span>
                </p>
              )}
            </div>
          )}

          {customMode && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-dark">
                  Prilagođeno vrijeme
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setSelectedSlot("");
                  }}
                  className="text-[10px] text-rose underline-offset-2 hover:underline cursor-pointer"
                >
                  Nazad na slobodne termine
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  name="custom_date"
                  type="date"
                  required
                  className="flex-1 border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
                />
                <select
                  name="custom_time"
                  required
                  defaultValue="17:00"
                  className="border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
                >
                  {Array.from({ length: 48 }, (_, i) => {
                    const h = String(Math.floor(i / 2)).padStart(2, "0");
                    const m = i % 2 === 0 ? "00" : "30";
                    return `${h}:${m}`;
                  }).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[10px] text-light">
                Napomena: prilagođeno vrijeme ne prolazi kroz provjeru
                raspoloživosti. Konflikt će biti prikazan pri čuvanju.
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
              Napomena (opciono)
            </span>
            <textarea
              name="notes"
              rows={2}
              className="w-full resize-none border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
            />
          </label>

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
              disabled={pending || (!customMode && !selectedSlot)}
              className="flex-1 bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Spremam..." : "Sačuvaj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
