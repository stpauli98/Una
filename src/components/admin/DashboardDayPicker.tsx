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
};

/**
 * Mali klijent kontroler za biranje dana koji se prikazuje na dashboardu.
 * Poziva router.push("/admin/dashboard?date=YYYY-MM-DD") kad korisnik
 * promijeni datum. Server Component se onda re-renderuje sa novim podacima.
 *
 * Bounds:
 *   - Past: bez limita (Una može pregledati istoriju)
 *   - Future: maxDateStr (server-passed, dolazi iz settings.advance_booking_days)
 */
export function DashboardDayPicker({
  selectedDateStr,
  todayDateStr,
  maxDateStr,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (next: string) => {
    startTransition(() => {
      router.push(`/admin/dashboard?date=${next}`);
    });
  };

  const goPrev = () => navigate(addDaysToDateStr(selectedDateStr, -1));
  const goNext = () => {
    const next = addDaysToDateStr(selectedDateStr, 1);
    if (next > maxDateStr) return;
    navigate(next);
  };
  const goToday = () => navigate(todayDateStr);

  const canGoNext = addDaysToDateStr(selectedDateStr, 1) <= maxDateStr;
  const isToday = selectedDateStr === todayDateStr;

  // formatDate prima Date — convertujemo iz dateStr preko parseDateSarajevo
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
          onChange={(e) => {
            const v = e.target.value;
            if (v && v <= maxDateStr) navigate(v);
          }}
          className="border border-cream bg-marble px-3 py-1.5 text-[13px] focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
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
            className="ml-2 border border-cream bg-white px-3 py-1.5 text-[10px] uppercase tracking-wider text-dark transition-colors hover:border-rose hover:text-rose disabled:opacity-60 cursor-pointer"
          >
            Danas
          </button>
        )}
      </div>

      <p
        className={cn(
          "text-[12px] capitalize",
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
