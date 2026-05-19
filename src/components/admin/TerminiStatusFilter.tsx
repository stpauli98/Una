"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { StatusCounts } from "@/lib/utils/status-counts";

type StatusFilter = "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";

type Props = {
  /** Trenutno selektovan status. */
  value: StatusFilter;
  /** Broj termina po statusu unutar trenutnog opsega. */
  counts: StatusCounts;
  /** Bazna ruta (npr. "/admin/termini"). */
  basePath: string;
  /** Dodatni query parametri koji se čuvaju uz status promjenu. */
  preserveParams?: Record<string, string | undefined>;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "svi", label: "Svi statusi" },
  { value: "ceka", label: "Čeka" },
  { value: "potvrdjen", label: "Potvrđen" },
  { value: "otkazan", label: "Otkazan" },
  { value: "zavrsen", label: "Završen" },
];

/**
 * Native <select> za filter po statusu termina. Zamjenjuje 5-chip toolbar
 * iz prethodne verzije — kompaktniji + dodaje broj termina pored svakog
 * statusa ("Čeka (3)").
 *
 * Brojevi su iz trenutnog opsega (date/range) — kad se promijeni opseg,
 * server re-renderuje sa novim counts.
 */
export function TerminiStatusFilter({
  value,
  counts,
  basePath,
  preserveParams,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (next: StatusFilter) => {
    const params = new URLSearchParams();
    if (next !== "svi") params.set("status", next);
    if (preserveParams) {
      for (const [k, v] of Object.entries(preserveParams)) {
        if (v && v.length > 0) params.set(k, v);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  const labelFor = (opt: { value: StatusFilter; label: string }): string => {
    if (opt.value === "svi") {
      const total = counts.ceka + counts.potvrdjen + counts.otkazan + counts.zavrsen;
      return `${opt.label} (${total})`;
    }
    return `${opt.label} (${counts[opt.value]})`;
  };

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as StatusFilter)}
      aria-label="Filter po statusu"
      className="border border-cream bg-marble px-3 py-1.5 text-[12px] focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:cursor-not-allowed disabled:opacity-60"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {labelFor(opt)}
        </option>
      ))}
    </select>
  );
}
