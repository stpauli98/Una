import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Supabase klijent za browser (client komponente).
 * Koristi anon key. Autentifikacija se čuva u cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
