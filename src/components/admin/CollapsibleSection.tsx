import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  /** Naslov sekcije (renderuje se kao h2 u summary-ju). */
  title: string;
  /** Kratak opis koji se vidi i kad je sekcija zatvorena. */
  description: string;
  /**
   * Opcioni meta JSX (npr. SectionMeta "Zadnje izmijenjeno") —
   * renderuje se ispod opisa, vidljiv u oba stanja.
   */
  meta?: ReactNode;
  /** Sadržaj koji se otkriva tek na klik. */
  children: ReactNode;
  /** Da li je default state open. Default false. */
  defaultOpen?: boolean;
};

/**
 * Collapsible sekcija za admin Postavke. Koristi native HTML <details>
 * + <summary> tako da:
 *   - ARIA expanded/collapsed automatski (screen reader friendly)
 *   - Tab/Enter/Space keyboard nav radi bez koda
 *   - Server komponent (nema useState, nula client JS-a)
 *   - Open state preživi router.refresh() (DOM zadržava `open` atribut
 *     kroz React reconciliation)
 *
 * Chevron rotacija preko Tailwind v4 `group-open:` variant —
 * `<details>` ima `group` klasu, ChevronDown ima
 * `group-open:rotate-180` koja se aktivira kad parent ima `open` atribut.
 *
 * `summary::-webkit-details-marker { display: none }` skida default
 * triangle browser marker — nadomještamo ga custom chevron-om.
 */
export function CollapsibleSection({
  title,
  description,
  meta,
  children,
  defaultOpen = false,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group border border-cream bg-white"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 transition-colors hover:bg-warm focus-visible:bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose [&::-webkit-details-marker]:hidden">
        <div className="flex-1">
          <h2 className="mb-1 font-display text-xl text-dark">{title}</h2>
          <p className="text-[12px] text-light">{description}</p>
          {meta}
        </div>
        <ChevronDown
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-light transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-cream p-5">{children}</div>
    </details>
  );
}
