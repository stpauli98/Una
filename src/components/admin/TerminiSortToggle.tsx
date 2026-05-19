"use client";

import Link from "next/link";
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Trenutni redoslijed. */
  sort: "asc" | "desc";
  /** Bazna ruta. */
  basePath: string;
  /** Dodatni query parametri koje treba zadržati uz sort promjenu. */
  preserveParams?: Record<string, string | undefined>;
};

/**
 * Toggle dugme za sortiranje termina po vremenu. Klik prebacuje asc↔desc
 * preko URL-a (server komponente onda re-renderuje sa novim redoslijedom).
 *
 * Vizuelno: ikonica + tekstualni label. Ikona se mijenja prema trenutnom
 * stanju — "Najraniji prvo" (asc, strelica nadolje) ili "Najkasniji prvo"
 * (desc, strelica nagore).
 */
export function TerminiSortToggle({
  sort,
  basePath,
  preserveParams,
}: Props) {
  const nextSort = sort === "asc" ? "desc" : "asc";
  const Icon = sort === "asc" ? ArrowDownNarrowWide : ArrowUpNarrowWide;
  const label = sort === "asc" ? "Najraniji prvo" : "Najkasniji prvo";

  const params = new URLSearchParams();
  params.set("sort", nextSort);
  if (preserveParams) {
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v && v.length > 0) params.set(k, v);
    }
  }

  return (
    <Link
      href={`${basePath}?${params.toString()}`}
      className={cn(
        "inline-flex items-center gap-1.5 border border-cream bg-white px-3 py-1.5 text-[11px] uppercase tracking-wider text-body transition-colors hover:border-rose hover:text-rose",
      )}
      aria-label={`Promijeni redoslijed: ${label}`}
    >
      <Icon size={14} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}
