import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseUrl, getSupabaseAnonKey } from "./env";

/**
 * Supabase klijent za read-only PUBLIC podatke na statičkim stranicama.
 *
 * KLJUČNA RAZLIKA od `createClient()` (server.ts): NEMA cookie access.
 * U Next 16, bilo koji poziv `cookies()` u RSC-u forsira dynamic rendering
 * (svaki request ide na origin, headers postavljeni na `private, no-store`).
 * Vercel WAF / bot-protection tretira takav response kao auth-protected
 * sadržaj i izaziva (challenge-uje) bot UA-ove kao što je facebookexternalhit,
 * što defeat-uje OpenGraph share previews.
 *
 * Sa cookie-free klijentom, public stranice mogu biti **statički
 * prerendered + ISR cached** (uz `export const revalidate = 300`). Vercel
 * CDN servira keširani HTML svima — uključujući FB / LinkedIn scraper-e —
 * sa `Cache-Control: public` i bez WAF challenge-a.
 *
 * Koristi za: featured services na homepage-u, lista usluga na /usluge,
 * cjenovnik, javne galerija slike. NIKAD za auth-required ili
 * user-specific podatke (login, admin, booking flow sa session-om).
 */
export function createPublicClient() {
  return createClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
