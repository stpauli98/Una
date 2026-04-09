import { normalizePhone } from "./phone";

/**
 * Generiše `wa.me` deep link iz telefonskog broja (BA lokalni ili
 * internacionalni) i poruke. Sve parse-uje preko `libphonenumber-js` da
 * bi se dobio E.164 format, pa se skine prefiks `+` (wa.me format).
 *
 * Primjeri:
 *   waLink("065 810 323", "Zdravo Una")     → wa.me/38765810323?text=...
 *   waLink("+49 151 23456789", "Hi Una")    → wa.me/4915123456789?text=...
 *   waLink("+38765810323",  "Bok Una")      → wa.me/38765810323?text=...
 */
export function waLink(phone: string, message: string): string {
  const e164 = normalizePhone(phone); // vraća +XXXXXXXX
  const digits = e164.startsWith("+") ? e164.slice(1) : e164.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
