"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, Repeat } from "lucide-react";
import {
  createTimeBlock,
  deleteTimeBlock,
  deleteTimeBlockSeries,
} from "@/app/admin/(protected)/postavke/actions";
import { formatDate, formatTime } from "@/lib/utils/format";
import { parseSarajevoDateTime } from "@/lib/utils/tz";
import type { Database } from "@/types/database";

type TimeBlock = Database["public"]["Tables"]["time_blocks"]["Row"];

/** 00:00, 00:30, 01:00, ..., 23:30 — usklađeno sa 30-min grid-om. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export function TimeBlocksManager({ blocks }: { blocks: TimeBlock[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [recurring, setRecurring] = useState(false);

  // Count blocks po grupi — za prikaz "(N termina)" pored Obriši seriju
  const groupCounts = blocks.reduce<Record<string, number>>((acc, b) => {
    if (b.recurrence_group_id) {
      acc[b.recurrence_group_id] = (acc[b.recurrence_group_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = e.currentTarget;
          const fd = new FormData(form);

          // Spoji date + time u ISO timestamp (prvi blok)
          const date = String(fd.get("block_date") ?? "");
          const startTime = String(fd.get("start_time_select") ?? "");
          const endTime = String(fd.get("end_time_select") ?? "");

          if (date && startTime) {
            fd.set(
              "start_time",
              parseSarajevoDateTime(date, startTime).toISOString(),
            );
          }
          if (date && endTime) {
            fd.set(
              "end_time",
              parseSarajevoDateTime(date, endTime).toISOString(),
            );
          }

          startTransition(async () => {
            const r = await createTimeBlock(fd);
            if (r.ok) {
              form.reset();
              setRecurring(false);
            } else {
              setError(r.error);
            }
          });
        }}
        className="mb-4 border border-cream bg-white p-4"
      >
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_1.5fr_auto]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
              Datum
            </label>
            <input
              name="block_date"
              type="date"
              required
              className="w-full border border-cream bg-marble px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
              Od
            </label>
            <select
              name="start_time_select"
              required
              defaultValue="09:00"
              className="border border-cream bg-marble px-2 py-1.5 text-xs"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-light">
              Do
            </label>
            <select
              name="end_time_select"
              required
              defaultValue="10:00"
              className="border border-cream bg-marble px-2 py-1.5 text-xs"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
        </div>

        {/* Recurring row — checkbox + 'Do datuma' (uvjetno) */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-cream pt-3 text-[12px] text-body">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="recurring_weekly"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="accent-rose"
            />
            <Repeat size={12} className="text-light" />
            Ponavlja se svake sedmice
          </label>
          {recurring && (
            <label className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-light">
                Do datuma
              </span>
              <input
                name="until_date_str"
                type="date"
                required
                className="border border-cream bg-marble px-2 py-1.5 text-xs"
              />
            </label>
          )}
          {recurring && (
            <p className="text-[10px] text-light">
              (kreiraju se pojedinačni blokovi za svaki dan iste oznake do
              izabranog datuma)
            </p>
          )}
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
            const groupId = b.recurrence_group_id;
            const groupSize = groupId ? groupCounts[groupId] : 0;
            return (
              <div
                key={b.id}
                className={`flex items-center justify-between gap-3 p-4 ${
                  i < blocks.length - 1 ? "border-b border-cream" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-dark">
                      {formatDate(start)} · {formatTime(start)} —{" "}
                      {formatTime(end)}
                    </p>
                    {groupId && (
                      <span
                        title={`Dio serije od ${groupSize} sedmičnih blokova`}
                        className="inline-flex items-center gap-1 border border-cream bg-warm px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-rose"
                      >
                        <Repeat size={9} />
                        Sedmično
                      </span>
                    )}
                  </div>
                  {b.reason && (
                    <p className="mt-0.5 text-[11px] text-light">{b.reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {groupId && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !confirm(
                            `Obrisati cijelu seriju (${groupSize} ${
                              groupSize === 1 ? "blok" : "blokova"
                            })?`,
                          )
                        )
                          return;
                        startTransition(async () => {
                          await deleteTimeBlockSeries(groupId);
                        });
                      }}
                      aria-label="Obriši cijelu seriju"
                      title="Obriši cijelu seriju"
                      className="inline-flex h-8 items-center gap-1 px-2 text-[10px] uppercase tracking-wider text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      Obriši seriju
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Ukloniti ovaj blok?")) return;
                      startTransition(async () => {
                        await deleteTimeBlock(b.id);
                      });
                    }}
                    aria-label="Ukloni ovaj blok"
                    title="Ukloni samo ovaj blok"
                    className="flex size-8 items-center justify-center text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
