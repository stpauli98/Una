import { format } from "date-fns";

/**
 * Srpski ijekavica latinica — ručne liste. `date-fns` `srLatn` locale vraća
 * ekavicu ("sreda", "nedelja"), što spec ne dozvoljava. Koristimo vlastite
 * nizove da garantujemo ijekavicu svugdje.
 */
const DANI = [
  "nedjelja",
  "ponedjeljak",
  "utorak",
  "srijeda",
  "četvrtak",
  "petak",
  "subota",
] as const;

const MJESECI = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
] as const;

/**
 * Formatira cijenu. Ako je primljen string (npr. "od 150 KM"), vraća ga
 * nepromijenjenog. Ako je broj, pripaja " KM". Decimale se formatiraju
 * zarezom kao decimalnim separatorom (srpska notacija).
 */
export function formatPrice(price: number | string): string {
  if (typeof price === "string") return price;
  if (Number.isInteger(price)) return `${price} KM`;
  return `${price.toFixed(2).replace(".", ",")} KM`;
}

/**
 * Formatira trajanje u minutama u čitljiv oblik.
 *   60 → "1h"
 *   90 → "1h 30min"
 *   45 → "45min"
 *   null/undefined → "—"
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}min`;
}

/** Datum u srpskoj ijekavici: "srijeda, 15. april" */
export function formatDate(date: Date): string {
  return `${DANI[date.getDay()]}, ${date.getDate()}. ${MJESECI[date.getMonth()]}`;
}

/** Datum bez dana u sedmici: "15. april 2026." */
export function formatLongDate(date: Date): string {
  return `${date.getDate()}. ${MJESECI[date.getMonth()]} ${date.getFullYear()}.`;
}

/** Vrijeme: "HH:mm" (nula-padovano). */
export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

/** Kombinovano: "srijeda, 15. april · 17:30" */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** Kratki datum: "15.04.2026." */
export function formatShortDate(date: Date): string {
  return format(date, "dd.MM.yyyy.");
}
