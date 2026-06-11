/**
 * Centralni mapping cache tagova za admin domain.
 *
 * Svaki ključ predstavlja jednu "logičku entiti" koju keširamo. Server
 * actions koje mutate-uju entitet pozivaju `revalidateTag(tag)` da bi
 * naredni server component fetch dobio svjež podatak.
 *
 * Zašto stringovi sa `admin:` prefiksom: ako kasnije dodamo public-facing
 * cache (npr. za /usluge stranicu), izbjegavamo case da admin invalidate
 * brže nego što treba (ili obrnuto). Eksplicitan namespace.
 */
export const ADMIN_CACHE_TAGS = {
  services: "admin:services",
  settings: "admin:settings",
  workingHours: "admin:working_hours",
  blockedDates: "admin:blocked_dates",
  timeBlocks: "admin:time_blocks",
  gallery: "admin:gallery",
  galleryCategories: "admin:gallery_categories",
} as const;

export type AdminCacheTag = (typeof ADMIN_CACHE_TAGS)[keyof typeof ADMIN_CACHE_TAGS];
