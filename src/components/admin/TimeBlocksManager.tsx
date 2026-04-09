"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  createTimeBlock,
  deleteTimeBlock,
} from "@/app/admin/(protected)/postavke/actions";
import { formatDate, formatTime } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type TimeBlock = Database["public"]["Tables"]["time_blocks"]["Row"];

export function TimeBlocksManager({ blocks }: { blocks: TimeBlock[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = e.currentTarget;
          const fd = new FormData(form);

          const startLocal = String(fd.get("start_time_local") ?? "");
          const endLocal = String(fd.get("end_time_local") ?? "");
          if (startLocal) fd.set("start_time", new Date(startLocal).toISOString());
          if (endLocal) fd.set("end_time", new Date(endLocal).toISOString());

          startTransition(async () => {
            const r = await createTimeBlock(fd);
            if (r.ok) {
              form.reset();
            } else {
              setError(r.error);
            }
          });
        }}
        className="mb-4 grid gap-2 border border-cream bg-white p-4 md:grid-cols-[1fr_1fr_1.5fr_auto]"
      >
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
            Od
          </label>
          <input
            name="start_time_local"
            type="datetime-local"
            required
            className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
            Do
          </label>
          <input
            name="end_time_local"
            type="datetime-local"
            required
            className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
            Razlog (opciono)
          </label>
          <input
            name="reason"
            type="text"
            placeholder="npr. zubar, pauza, privatno"
            className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-[31px] items-center justify-center gap-1 bg-rose px-4 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
          >
            <Plus size={12} />
            Dodaj
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-3 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="py-6 text-center text-sm text-light">
          Nema blokiranih vremenskih intervala.
        </p>
      ) : (
        <div className="overflow-hidden border border-cream bg-white">
          {blocks.map((b, i) => {
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);
            return (
              <div
                key={b.id}
                className={`flex items-center justify-between gap-3 p-4 ${
                  i < blocks.length - 1 ? "border-b border-cream" : ""
                }`}
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-dark">
                    {formatDate(start)} · {formatTime(start)} — {formatTime(end)}
                  </p>
                  {b.reason && (
                    <p className="mt-0.5 text-[11px] text-light">{b.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Ukloniti ovaj blok?")) return;
                    startTransition(async () => {
                      await deleteTimeBlock(b.id);
                    });
                  }}
                  aria-label="Ukloni"
                  className="flex size-8 items-center justify-center text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
