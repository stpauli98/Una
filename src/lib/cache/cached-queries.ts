import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";

/**
 * Cached query helperi za rijetko-mijenjane admin podatke.
 *
 * `unstable_cache` keširaše rezultat između requestova na nivou Vercel
 * data cache-a. Invalidacija je eksplicitna preko `updateTag` (server
 * actions), što znači mutating actions MORAJU pozvati updateTag sa
 * odgovarajućim ADMIN_CACHE_TAGS ključem.
 *
 * Zašto ne `revalidate: N` (time-based): stale podaci do N sekundi
 * nakon write-a nisu prihvatljivi za admin UI (Una mijenja servis pa
 * odmah želi vidjeti promjenu). Tag-based daje instant invalidaciju.
 *
 * BITNO: koristimo `createAdminClient()` (service role, bez cookies)
 * umjesto `createClient()` (anon + cookies). Next 16 eksplicitno
 * zabranjuje čitanje `cookies()` ili `headers()` unutar `unstable_cache`
 * scope-a — to baca Server Components render error u produkciji.
 *
 * Service role bypass-uje RLS, ali to je OK ovdje:
 * - Pristup ovim helperima je samo iz `(protected)` admin layout-a
 * - Proxy + layout već garantuju da je sesija autenticated admin
 * - Tabele koje čitamo (services, gallery_images, working_hours,
 *   blocked_dates, time_blocks, settings) nemaju per-user podatke
 *
 * Pošto cached data nije user-specific, dijeljenje između requestova
 * je sigurno — svi admini vide isti katalog.
 */

export const getCachedServices = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb
      .from("services")
      .select("*")
      .order("order_index");
    return data ?? [];
  },
  ["admin-services-all"],
  { tags: [ADMIN_CACHE_TAGS.services] },
);

export const getCachedGalleryImages = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb
      .from("gallery_images")
      .select("id, storage_path, category, alt_text")
      .order("order_index");
    return data ?? [];
  },
  ["admin-gallery-all"],
  { tags: [ADMIN_CACHE_TAGS.gallery] },
);

export const getCachedWorkingHours = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb.from("working_hours").select("*");
    return data ?? [];
  },
  ["admin-working-hours-all"],
  { tags: [ADMIN_CACHE_TAGS.workingHours] },
);

export const getCachedBlockedDates = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb
      .from("blocked_dates")
      .select("*")
      .order("date_from");
    return data ?? [];
  },
  ["admin-blocked-dates-all"],
  { tags: [ADMIN_CACHE_TAGS.blockedDates] },
);

export const getCachedTimeBlocks = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb
      .from("time_blocks")
      .select("*")
      .order("start_time");
    return data ?? [];
  },
  ["admin-time-blocks-all"],
  { tags: [ADMIN_CACHE_TAGS.timeBlocks] },
);

export const getCachedSettings = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb
      .from("settings")
      .select("key,value,updated_at");
    return data ?? [];
  },
  ["admin-settings-all"],
  { tags: [ADMIN_CACHE_TAGS.settings] },
);
