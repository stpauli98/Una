/**
 * Sanitizirane Supabase env vars (lazy getters).
 *
 * Vercel UI ponekad upiše trailing `\n` kad se vrijednost paste-uje
 * iz terminala / Supabase Dashboard-a. Browser ubaci doslovan `%0A`
 * u WebSocket query string (`?apikey=...%0A&vsn=2.0.0`), Supabase
 * Realtime odbija to → CHANNEL_ERROR pri WS handshake-u.
 *
 * BITNO — lazy evaluation: Next 16 "Collecting page data" faza pokreće
 * worker procese gdje env vars nisu uvijek dostupne pri top-level
 * import-u. Ako bacamo na import-u, build fail-uje. Umjesto toga,
 * izlazimo gettere koji validiraju + trim-uju TEK kad se vrijednost
 * čita (pri pozivu client fabrike).
 */

function readRequired(name: string): string {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return raw.trim();
}

function readOptional(name: string): string | undefined {
  const raw = process.env[name];
  return raw ? raw.trim() : undefined;
}

export function getSupabaseUrl(): string {
  return readRequired("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return readRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return readOptional("SUPABASE_SERVICE_ROLE_KEY");
}
