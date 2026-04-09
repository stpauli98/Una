import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase klijent sa service role ključem. Zaobilazi RLS.
 * SAMO za server-side kod (server actions, route handlers, cron jobs).
 * NIKAD ne importovati iz client komponenti.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
