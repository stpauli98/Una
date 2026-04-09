/**
 * Generiše `wa.me` deep link iz BA/RS telefonskog broja i poruke.
 * Prihvata različite formate: `065...`, `+387...`, `0038765...`,
 * sa razmacima, crticama i tačkama.
 *
 * @example waLink("065 810 323", "Zdravo Una") → "https://wa.me/38765810323?text=Zdravo%20Una"
 */
export function waLink(phone: string, message: string): string {
  let clean = phone.replace(/[^\d]/g, "");
  if (clean.startsWith("00")) clean = clean.slice(2);
  if (clean.startsWith("0")) clean = "387" + clean.slice(1);
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
