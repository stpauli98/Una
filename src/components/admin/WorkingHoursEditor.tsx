"use client";

import { useState, useTransition } from "react";
import { updateWorkingHour } from "@/app/admin/(protected)/postavke/actions";
import type { Database } from "@/types/database";

type WorkingHour = Database["public"]["Tables"]["working_hours"]["Row"];

const DAY_NAMES = [
  "Nedjelja",
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
] as const;

/** Generiše opcije 00:00, 00:30, 01:00, ..., 23:30 */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export function WorkingHoursEditor({ hours }: { hours: WorkingHour[] }) {
  const sorted = [...hours].sort((a, b) => {
    const ord = [1, 2, 3, 4, 5, 6, 0];
    return ord.indexOf(a.day_of_week) - ord.indexOf(b.day_of_week);
  });

  return (
    <div className="space-y-2">
      {sorted.map((h) => (
        <WorkingHourRow key={h.day_of_week} hour={h} />
      ))}
    </div>
  );
}

function WorkingHourRow({ hour }: { hour: WorkingHour }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        const fd = new FormData(e.currentTarget);
        fd.set("day_of_week", String(hour.day_of_week));
        startTransition(async () => {
          const r = await updateWorkingHour(fd);
          if (r.ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }
        });
      }}
      className="border border-cream bg-white p-3"
    >
      {/* Row 1: Dan + checkbox */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-dark">
          {DAY_NAMES[hour.day_of_week]}
        </span>
        <label className="flex items-center gap-2 text-[11px] text-body">
          <input
            type="checkbox"
            name="is_open"
            defaultChecked={hour.is_open}
            className="accent-rose"
          />
          Otvoreno
        </label>
      </div>

      {/* Row 2: Vrijeme + sacuvaj */}
      <div className="mt-2 flex items-center gap-2">
        <select
          name="open_time"
          defaultValue={hour.open_time.slice(0, 5)}
          className="flex-1 border border-cream bg-marble px-2 py-1.5 text-[12px]"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-light">—</span>
        <select
          name="close_time"
          defaultValue={hour.close_time.slice(0, 5)}
          className="flex-1 border border-cream bg-marble px-2 py-1.5 text-[12px]"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="bg-rose px-3 py-1.5 text-[10px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
        >
          {pending ? "..." : "Sačuvaj"}
        </button>
      </div>

      {saved && (
        <p className="mt-1.5 text-right text-[10px] uppercase tracking-wider text-green-600">
          ✓ Sačuvano
        </p>
      )}
    </form>
  );
}
