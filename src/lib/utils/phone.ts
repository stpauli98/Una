/**
 * BA/RS telefon — normalizacija i validacija.
 *
 * Prihvaćeni prefiksi za mobilne mreže u BiH:
 *   061, 062, 063 (BH Telecom / HT Eronet — FBiH)
 *   065, 066, 067 (Telekom Srpske / m:tel — RS)
 */

const MOBILE_PREFIXES = [
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
] as const;

/**
 * Vraća broj u kanonskoj formi `+387XXXXXXXX`.
 * Ne validira — samo normalizuje format.
 */
export function normalizeBaPhone(input: string): string {
  let d = input.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "387" + d.slice(1);
  return "+" + d;
}

/**
 * Provjerava da li je ulaz validan BA mobilni broj.
 * Mora biti oblik `387<prefix>XXXXXXX` gdje je prefix iz `MOBILE_PREFIXES`
 * i ukupan broj cifara iza "387" je 8 ili 9.
 */
export function isValidBaPhone(input: string): boolean {
  if (!input) return false;
  const n = normalizeBaPhone(input).replace("+", "");
  if (!n.startsWith("387")) return false;
  const rest = n.slice(3);
  if (rest.length < 8 || rest.length > 9) return false;
  const prefix = rest.slice(0, 2);
  return (MOBILE_PREFIXES as readonly string[]).includes(prefix);
}
