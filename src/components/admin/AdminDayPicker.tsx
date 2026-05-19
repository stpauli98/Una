"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysToDateStr } from "@/lib/utils/day-bounds";
import { formatDate } from "@/lib/utils/format";
import { parseDateSarajevo } from "@/lib/utils/tz";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Trenutno izabrani datum kao YYYY-MM-DD (Sarajevo TZ). */
  selectedDateStr: string;
  /** Današnji dan kao YYYY-MM-DD (server-rendered, da klijent i server vide
   *  isti "danas" — sprječava hydration mismatch). */
  todayDateStr: string;
  /** Maksimalan datum unaprijed (YYYY-MM-DD), inkluzivno. */
  maxDateStr: string;
  /** Bazna ruta na koju idu klikovi (npr. "/admin/dashboard" ili "/admin/termini"). */
  basePath: string;
  /** Dodatni query parametri koji ostaju netaknuti pri navigaciji
   *  (npr. status=ceka da se sačuva uz date promjenu). */
  preserveParams?: Record<string, string | undefined>;
};

/**
 * Generic day picker za admin stranice. Klik na ←/→ ili promjena
 * input[type=date] poziva `router.push(${basePath}?date=YYYY-MM-DD&...)`.
 *
 * Bounds:
 *   - Past: bez limita (Una može pregledati istoriju)
 *   - Future: maxDateStr (server-passed, dolazi iz settings.advance_booking_days)
 */
export function AdminDayPicker({
  selectedDateStr,
  todayDateStr,
  maxDateStr,
  basePath,
  preserveParams,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const buildHref = (dateStr: string): string => {
    const params = new URLSearchParams();
    params.set("date", dateStr);
    if (preserveParams) {
      for (const [k, v] of Object.entries(preserveParams)) {
        if (v && v.length > 0) params.set(k, v);
      }
    }
    return `${basePath}?${params.toString()}`;
  };

  const navigate = (next: string) => {
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  const nextDateStr = addDaysToDateStr(selectedDateStr, 1);
  const canGoNext = nextDateStr <= maxDateStr;
  const isToday = selectedDateStr === todayDateStr;

  const goPrev = () => navigate(addDaysToDateStr(selectedDateStr, -1));
  const goNext = () => {
    if (!canGoNext) return;
    navigate(nextDateStr);
  };
  const goToday = () => navigate(todayDateStr);

  const displayLabel = formatDate(parseDateSarajevo(selectedDateStr));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={goPrev}
          disabled={pending}
          aria-label="Prethodni dan"
          className="flex size-8 items-center justify-center rounded-full text-dark transition-colors hover:bg-warm disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>

        <input
          type="date"
          value={selectedDateStr}
          max={maxDateStr}
          disabled={pending}
          aria-label="Izaberi datum"
          onChange={(e) => {
            const v = e.target.value;
            if (v && v <= maxDateStr) navigate(v);
          }}
          className="border border-cream bg-marble px-3 py-1.5 text-[13px] focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          onClick={goNext}
          disabled={pending || !canGoNext}
          aria-label="Sljedeći dan"
          className="flex size-8 items-center justify-center rounded-full text-dark transition-colors hover:bg-warm disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>

        {!isToday && (
          <button
            type="button"
            onClick={goToday}
            disabled={pending}
            className="ml-2 border border-cream bg-white px-3 py-1.5 text-[10px] uppercase tracking-wider text-dark transition-colors hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            Danas
          </button>
        )}
      </div>

      <p
        className={cn(
          "text-[12px] first-letter:uppercase",
          isToday ? "text-rose font-medium" : "text-light",
        )}
        aria-live="polite"
      >
        {displayLabel}
        {isToday && " · danas"}
      </p>
    </div>
  );
}
