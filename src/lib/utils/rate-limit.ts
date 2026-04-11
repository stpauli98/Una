/**
 * Simple in-memory rate limiter for serverless functions.
 *
 * Limitations:
 * - Resets on cold start (Vercel serverless)
 * - Not shared across instances
 *
 * For production hardening, replace with Upstash Redis or Vercel KV.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check if a request should be rate limited.
 * @returns `true` if the request is allowed, `false` if rate limited.
 */
export function checkRateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000,
): boolean {
  cleanup();

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= limit;
}
