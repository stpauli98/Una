/**
 * Single source of truth za listu galerija kategorija.
 *
 * Importovati iz:
 *   - src/components/admin/GalleryManager.tsx (admin upload UI)
 *   - src/components/public/GalleryGrid.tsx (public filter UI — "Sve" se dodaje na vrh tamo)
 *   - src/app/admin/(protected)/galerija/actions.ts (server validacija)
 *
 * Redoslijed u nizu kontroliše prikaz dugmadi/dropdown-a u UI.
 *
 * Key MORA biti lowercase ASCII bez razmaka — koristi se u storage filename
 * pattern-u (`<category>/<timestamp>-<random>.webp`) i kao DB string vrijednost.
 */
export type GalleryCategoryDef = {
  /** Stable identifier (lowercase ASCII). Koristi se u storage path-u i DB-u. */
  readonly key: string;
  /** Prikazni naziv u UI (može imati dijakritike). */
  readonly label: string;
};

export const GALLERY_CATEGORIES: readonly GalleryCategoryDef[] = [
  { key: "sminkanje", label: "Šminkanje" },
  { key: "svadbeno", label: "Svadbeno" },
  { key: "pedikir", label: "Pedikir" },
  { key: "trepavice", label: "Trepavice" },
  { key: "obuka", label: "Obuka" },
] as const;

/** Lista samo key-jeva (corresponds 1:1 to GALLERY_CATEGORIES order). */
export const GALLERY_CATEGORY_KEYS = GALLERY_CATEGORIES.map(
  (c) => c.key,
) as readonly string[];

/** Type-safe union svih dozvoljenih kategorija. */
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]["key"];

/** Type guard za sigurnu validaciju (npr. server input parsing). */
export function isValidGalleryCategory(
  value: string,
): value is GalleryCategory {
  return GALLERY_CATEGORY_KEYS.includes(value);
}
