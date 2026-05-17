/**
 * Normalizuje `NEXT_PUBLIC_SITE_URL` (ili bilo koji URL string) tako da:
 *  - skida svaki trailing whitespace (newline, space, tab) — defensive protiv
 *    Vercel env var-ova kojima se nepažljivo paste-uje vrijednost sa newline-om
 *    (poznati bug u UP Beauty Vercel projektu).
 *  - skida trailing slash da konkatenacija sa path-om ne proizvede `//`.
 *
 * Whitespace stripping je KRITIČNO za Schema.org JSON-LD `@id`/`url` fields:
 * literalni `\n` u sredini URL-a (nakon konkatenacije sa path-om) razbije
 * Google parser i ruši rich-result eligibility.
 *
 * Bezbjedna za prazne/undefined inpute — vrati fallback ako proslijeđen.
 */
export function normalizeSiteUrl(
  url: string | undefined,
  fallback: string = "http://localhost:3000",
): string {
  const value = url ?? fallback;
  // Strip any trailing combination of whitespace + slash in one pass.
  // (sequential `.replace(/\s+$/, "").replace(/\/$/, "")` failed na input
  // poput `"https://x\n/"` jer prvi prolaz nije našao trailing whitespace
  // — trailing je bio `/`, a drugi prolaz nije takao newline koji je bio
  // prije slash-a. Combined character class to rješava jednim passom.)
  return value.replace(/[\s/]+$/, "");
}
