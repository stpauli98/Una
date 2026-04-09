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

export function WorkingHoursEditor({ hours }: { hours: WorkingHour[] }) {
  // Sort pon-ned za prikaz
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
      className="grid grid-cols-[100px_auto_auto_auto_1fr] items-center gap-3 border border-cream bg-white p-3"
    >
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
      <input
        type="time"
        name="open_time"
        defaultValue={hour.open_time.slice(0, 5)}
        className="border border-cream bg-marble px-2 py-1 text-[12px]"
      />
      <input
        type="time"
        name="close_time"
        defaultValue={hour.close_time.slice(0, 5)}
        className="border border-cream bg-marble px-2 py-1 text-[12px]"
      />
      <div className="flex justify-end gap-2">
        {saved && (
          <span className="text-[10px] uppercase tracking-wider text-green-600">
            ✓ Sačuvano
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-rose px-3 py-1.5 text-[10px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
        >
          {pending ? "..." : "Sačuvaj"}
        </button>
      </div>
    </form>
  );
}
