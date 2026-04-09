"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatTime } from "@/lib/utils/format";
import { BOOKING_RULES } from "@/lib/constants/business";

type Slot = { start: string; end: string };

type Props = {
  serviceId: number;
  serviceName: string;
  onSelect: (startTimeIso: string) => void;
  onBack: () => void;
};

const DAYS_HEADER = ["pon", "uto", "sri", "čet", "pet", "sub", "ned"] as const;
const MJESECI_HEADER = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
] as const;

export function StepCalendar({
  serviceId,
  serviceName,
  onSelect,
  onBack,
}: Props) {
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + BOOKING_RULES.advance_booking_days);
    return d;
  }, [today]);

  // Grid: trailing days of previous month to align Monday-start
  const monthDays = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start, end });

    // shift: 0=Mon, 6=Sun → getDay() returns 0=Sun; convert:
    const getMondayIdx = (d: Date) => (d.getDay() + 6) % 7;
    const padStart = getMondayIdx(start);
    const padEnd = 6 - getMondayIdx(end);

    const leading: (Date | null)[] = Array.from({ length: padStart }, () => null);
    const trailing: (Date | null)[] = Array.from({ length: padEnd }, () => null);

    return [...leading, ...days, ...trailing];
  }, [viewMonth]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    fetch(`/api/availability?date=${dateStr}&service_id=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, serviceId]);

  const canGoPrev = !isSameMonth(viewMonth, today);
  const canGoNext = viewMonth < addMonths(startOfMonth(today), 3);

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, today)) return true;
    if (isBefore(maxDate, date)) return true;
    const weekday = date.getDay();
    const weekdayDays = BOOKING_RULES.weekday.days as readonly number[];
    const weekendDays = BOOKING_RULES.weekend.days as readonly number[];
    return !weekdayDays.includes(weekday) && !weekendDays.includes(weekday);
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-light transition-colors hover:text-rose cursor-pointer"
        >
          <ChevronLeft size={12} /> Promijeni uslugu
        </button>
        <h2 className="mb-1 font-display text-3xl font-light text-dark md:text-4xl">
          Izaberite termin
        </h2>
        <p className="text-[13px] text-rose">{serviceName}</p>
      </div>

      <div className="mx-auto max-w-[520px] border border-cream bg-white p-5 md:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            disabled={!canGoPrev}
            aria-label="Prethodni mjesec"
            className="flex size-8 items-center justify-center rounded-full text-dark transition-colors hover:bg-warm disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="font-display text-lg text-dark">
            {MJESECI_HEADER[viewMonth.getMonth()]} {viewMonth.getFullYear()}.
          </p>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            disabled={!canGoNext}
            aria-label="Sljedeći mjesec"
            className="flex size-8 items-center justify-center rounded-full text-dark transition-colors hover:bg-warm disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day labels */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DAYS_HEADER.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] uppercase tracking-wider text-light"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const disabled = isDateDisabled(date);
            const selected = selectedDate && isSameDay(date, selectedDate);
            return (
              <button
                key={date.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex aspect-square items-center justify-center text-sm transition-colors cursor-pointer",
                  disabled
                    ? "cursor-not-allowed text-cream"
                    : selected
                      ? "bg-rose font-medium text-white"
                      : "text-dark hover:bg-warm",
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {selectedDate && (
        <div className="mx-auto mt-6 max-w-[520px]">
          <p className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-light">
            Slobodni termini
          </p>
          {loading ? (
            <p className="text-center text-sm text-light">Učitavanje...</p>
          ) : slots && slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {slots.map((slot) => {
                const start = new Date(slot.start);
                return (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => onSelect(slot.start)}
                    className="border border-cream bg-white px-3 py-3 text-sm text-dark transition-colors hover:border-rose hover:bg-rose hover:text-white cursor-pointer"
                  >
                    {formatTime(start)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="border border-cream bg-white p-8 text-center">
              <p className="text-sm text-light">
                Nema slobodnih termina za ovaj dan.
              </p>
              <p className="mt-1 text-xs text-light">
                Pokušajte drugi datum ili nas kontaktirajte direktno.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
