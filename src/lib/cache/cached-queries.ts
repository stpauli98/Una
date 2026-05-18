import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";

/**
 * Cached query helperi za rijetko-mijenjane admin podatke.
 *
 * `unstable_cache` keširaše rezultat između requestova na nivou Vercel
 * data cache-a. Invalidacija je eksplicitna preko `revalidateTag`, što
 * znači da mutating server actions MORAJU pozvati `revalidateTag` sa
 * odgovarajućim ADMIN_CACHE_TAGS ključem.
 *
 * Zašto ne `revalidate: N` (time-based): time-based cache znači stale
 * podaci do N sekundi nakon write-a, što za admin UI nije prihvatljivo
 * (Una mijenja servis pa odmah želi vidjeti promjenu). Tag-based daje
 * instant invalidaciju na write + indefinite cache na read.
 *
 * BITNO: ovi helperi zovu `createClient()` koji čita cookies → nisu
 * pure. `unstable_cache` ipak radi jer Next ulazi sa svježim cookies
 * po requestu, a cached payload je zavisan samo od stringified args.
 * Za admin domen cookies su uvijek admin cookies (proxy garantuje), pa
 * nema rizik od leak-a podataka između korisnika.
 */

export const getCachedServices = unstable_cache(
  async () => {
    const sb = await createClient();
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
    const sb = await createClient();
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
    const sb = await createClient();
    const { data } = await sb.from("working_hours").select("*");
    return data ?? [];
  },
  ["admin-working-hours-all"],
  { tags: [ADMIN_CACHE_TAGS.workingHours] },
);

export const getCachedBlockedDates = unstable_cache(
  async () => {
    const sb = await createClient();
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
    const sb = await createClient();
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
    const sb = await createClient();
    const { data } = await sb.from("settings").select("key,value");
    return data ?? [];
  },
  ["admin-settings-all"],
  { tags: [ADMIN_CACHE_TAGS.settings] },
);
