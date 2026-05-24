"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { exportAppointmentsCsv } from "@/app/admin/(protected)/postavke/export-actions";

type Props = {
  /** Lista godina za koje IMA termina (računato server-side iz min/max start_time). */
  availableYears: number[];
};

/**
 * UI za preuzimanje CSV export-a termina. Dropdown bira godinu (ili "Sve"),
 * dugme triggera server action, klijent wrappa response u Blob i pokreće
 * download — bez API route-a, sve preko Next.js server action-a.
 */
export function CsvExportButton({ availableYears }: Props) {
  const [year, setYear] = useState<"all" | number>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastInfo, setLastInfo] = useState<string | null>(null);

  const onDownload = () => {
    setError(null);
    setLastInfo(null);
    startTransition(async () => {
      const yearParam = year === "all" ? null : year;
      const res = await exportAppointmentsCsv(yearParam);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.rowCount === 0) {
        setError(
          year === "all"
            ? "Nema termina za export."
            : `Nema termina u ${year}. godini.`,
        );
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastInfo(
        `Preuzeto: ${res.filename} (${res.rowCount} termina)`,
      );
      setTimeout(() => setLastInfo(null), 5000);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[12px] text-body">
          Godina:
          <select
            value={year}
            onChange={(e) =>
              setYear(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            disabled={pending}
            className="border border-cream bg-marble px-3 py-1.5 text-[12px] focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
          >
            <option value="all">Sve godine</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}.
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDownload}
          disabled={pending}
          className="inline-flex items-center gap-1.5 border border-rose bg-white px-4 py-2 text-[12px] text-rose hover:bg-warm disabled:opacity-50 cursor-pointer"
        >
          <Download size={13} />
          {pending ? "Pripremam..." : "Preuzmi CSV"}
        </button>
      </div>
      {lastInfo && (
        <p className="text-[12px] text-green-700">✓ {lastInfo}</p>
      )}
      {error && <p className="text-[12px] text-rose">{error}</p>}
    </div>
  );
}
