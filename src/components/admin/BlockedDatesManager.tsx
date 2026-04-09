"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  addBlockedDate,
  removeBlockedDate,
} from "@/app/admin/(protected)/postavke/actions";
import { formatShortDate } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type BlockedDate = Database["public"]["Tables"]["blocked_dates"]["Row"];

export function BlockedDatesManager({ dates }: { dates: BlockedDate[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await addBlockedDate(fd);
            if (r.ok) {
              (e.target as HTMLFormElement).reset();
            } else {
              setError(r.error);
            }
          });
        }}
        className="mb-4 grid gap-2 border border-cream bg-white p-4 md:grid-cols-[auto_auto_1fr_auto]"
      >
        <input
          type="date"
          name="date_from"
          required
          className="border border-cream bg-marble px-3 py-2 text-[12px]"
        />
        <input
          type="date"
          name="date_to"
          required
          className="border border-cream bg-marble px-3 py-2 text-[12px]"
        />
        <input
          type="text"
          name="reason"
          placeholder="Razlog (npr. Godišnji odmor)"
          className="border border-cream bg-marble px-3 py-2 text-[12px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1 bg-rose px-4 py-2 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
        >
          <Plus size={12} />
          Dodaj
        </button>
      </form>

      {error && (
        <div className="mb-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {dates.length === 0 ? (
        <p className="py-6 text-center text-sm text-light">
          Nema blokiranih datuma.
        </p>
      ) : (
        <div className="overflow-hidden border border-cream bg-white">
          {dates.map((d, i) => (
            <div
              key={d.id}
              className={`flex items-center justify-between gap-3 p-4 ${
                i < dates.length - 1 ? "border-b border-cream" : ""
              }`}
            >
              <div className="flex-1">
                <p className="text-[13px] font-medium text-dark">
                  {formatShortDate(new Date(d.date_from))}
                  {d.date_from !== d.date_to &&
                    ` — ${formatShortDate(new Date(d.date_to))}`}
                </p>
                {d.reason && (
                  <p className="text-[11px] text-light">{d.reason}</p>
                )}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Ukloniti ovaj blokirani datum?")) return;
                  startTransition(async () => {
                    await removeBlockedDate(d.id);
                  });
                }}
                aria-label="Ukloni"
                className="flex size-8 items-center justify-center text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
