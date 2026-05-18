/**
 * Sanitizirane Supabase env vars (lazy getters, non-throwing).
 *
 * Vercel UI ponekad upiše trailing `\n` kad se vrijednost paste-uje
 * iz terminala / Supabase Dashboard-a. Browser ubaci doslovan `%0A`
 * u WebSocket query string (`?apikey=...%0A&vsn=2.0.0`), Supabase
 * Realtime odbija to → CHANNEL_ERROR pri WS handshake-u.
 *
 * Single job ovih helpera: trim. NE bacaju ako env vara fali —
 * Supabase JS klijent već fail-uje elegantno kad mu se da prazan URL
 * (fetch error u runtime-u). Bacanje na lazy poziv lomilo je Vercel
 * "Generating static pages" worker za rute koje importuju Supabase
 * module-e pri prerender-u (`/cjenovnik` → `api/availability/route`).
 */

function trimmed(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getSupabaseUrl(): string {
  return trimmed("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return trimmed("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return trimmed("SUPABASE_SERVICE_ROLE_KEY");
}
