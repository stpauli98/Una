import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseUrl, getSupabaseAnonKey } from "./env";

/**
 * Supabase klijent za server komponente, route handlere i server actions.
 * Koristi anon key ali čita session iz cookies → respektuje RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` se poziva iz RSC-a — ne može da piše cookies.
            // Tiho ignorisati; middleware će refresh-ovati session.
          }
        },
      },
    },
  );
}
