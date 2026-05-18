import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Supabase klijent za browser (client komponente).
 * Koristi anon key. Autentifikacija se čuva u cookies.
 *
 * Env vars idu kroz `./env` koji ih trim-uje — sprječava trailing
 * whitespace iz Vercel env UI da slomi WebSocket handshake (Realtime
 * apikey query param).
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
