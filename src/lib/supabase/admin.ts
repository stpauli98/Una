import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "./env";

/**
 * Supabase klijent sa service role ključem. Zaobilazi RLS.
 * SAMO za server-side kod (server actions, route handlers, cron jobs).
 * NIKAD ne importovati iz client komponenti.
 */
export function createAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
