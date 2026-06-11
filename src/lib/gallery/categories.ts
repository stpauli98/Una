/**
 * Gallery kategorije su sada DINAMIČKE (DB tabela `gallery_categories`).
 * Lista se čita preko `getCachedGalleryCategories()` (cached-queries.ts) ili
 * direktno (public stranica koristi createPublicClient). Ovaj modul drži samo:
 * tip, slug helper, i validaciju nad prosljeđenom listom key-jeva.
 */

export type GalleryCategoryDef = {
  readonly key: string;
  readonly label: string;
};

/** Kategorija je sada proizvoljan string key (validira se protiv DB liste). */
export type GalleryCategory = string;

/**
 * Pretvara prikazni label u stabilan lowercase-ASCII slug za `key`.
 * Skida srpsku dijakritiku, zamjenjuje ne-alfanumerike crticom.
 * Vraća "" ako nema upotrebljivih znakova (caller mora rukovati tim slučajem).
 */
export function slugifyCategory(label: string): string {
  const map: Record<string, string> = {
    š: "s", đ: "dj", č: "c", ć: "c", ž: "z",
    Š: "s", Đ: "dj", Č: "c", Ć: "c", Ž: "z",
  };
  return label
    .trim()
    .replace(/[šđčćžŠĐČĆŽ]/g, (ch) => map[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validira da je `value` jedan od dozvoljenih key-jeva iz prosljeđene liste. */
export function isValidGalleryCategory(
  value: string,
  validKeys: readonly string[],
): boolean {
  return validKeys.includes(value);
}
