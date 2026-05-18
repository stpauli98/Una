import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env";

/**
 * Supabase klijent sa service role ključem. Zaobilazi RLS.
 * SAMO za server-side kod (server actions, route handlers, cron jobs).
 * NIKAD ne importovati iz client komponenti.
 */
export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
