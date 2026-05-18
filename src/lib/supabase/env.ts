/**
 * Sanitizirane Supabase env vars.
 *
 * Vercel UI ponekad upiše trailing `\n` (ili druge whitespace karaktere)
 * kad se vrijednost paste-uje iz terminala / Supabase Dashboard-a. Browser
 * onda ubaci doslovan `%0A` u WebSocket query string (npr.
 * `?apikey=...%0A&vsn=2.0.0`), a Supabase Realtime to odbija kao invalid
 * apikey i WS handshake fail-uje sa CHANNEL_ERROR. Slično lomi REST API
 * pozive sa neuobičajenim 401/400.
 *
 * Sve vrijednosti idu kroz `.trim()` pri import-u. Throw-amo ako neka
 * obavezna varijabla fali — bolje fail loud pri startup-u nego silent
 * misbehavior u runtime-u.
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

export const SUPABASE_URL = readRequired("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = readRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = readOptional("SUPABASE_SERVICE_ROLE_KEY");
