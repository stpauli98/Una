import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Phone validacija i normalizacija.
 *
 * Podrazumijevana zemlja je BA (Bosna i Hercegovina) — dakle lokalni format
 * `065 810 323` se tretira kao BA mobilni. Međutim, broj koji počinje sa
 * `+` (E.164) ili `00` se parsira kao internacionalni, pa se dijaspora
 * i turisti mogu prijaviti sa bilo kojeg broja u svijetu.
 */

const DEFAULT_COUNTRY: CountryCode = "BA";

/**
 * Vraća broj u E.164 formatu (`+XXXXXXXXXXX`). Ako ne uspije parse,
 * vraća original kao fallback.
 */
export function normalizePhone(
  input: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  return parsed ? parsed.number : input;
}

/**
 * Provjerava da li je ulaz validan međunarodni ili lokalni broj.
 * Lokalni brojevi bez country code-a se interpretiraju kao BA.
 */
export function isValidPhone(
  input: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): boolean {
  if (!input || !input.trim()) return false;
  try {
    return isValidPhoneNumber(input, defaultCountry);
  } catch {
    return false;
  }
}

// ─── Backwards-compatible aliases ───────────────────────────────────────
// Stariji kod i dalje importuje `normalizeBaPhone` / `isValidBaPhone`.
// Održavamo ove nazive da se ne polomi postojeći import graf.

/** @deprecated Use `normalizePhone` instead — sada podržava i međunarodne brojeve. */
export const normalizeBaPhone = normalizePhone;

/** @deprecated Use `isValidPhone` instead — sada podržava i međunarodne brojeve. */
export const isValidBaPhone = isValidPhone;
