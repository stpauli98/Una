/**
 * Rate limiter sa Upstash Redis backend-om u produkciji,
 * in-memory fallback-om u dev/test (gdje Upstash env vars nisu setovane).
 *
 * Upstash je distribuirani — radi i na multi-region Vercel deploy-evima.
 * In-memory fallback resetuje na cold start; OK za lokalni dev i CI.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Extract client IP from request headers.
 * Prefers `x-real-ip` (set by Vercel/nginx, not spoofable by the client)
 * over `x-forwarded-for` (uses last entry — the one appended by the
 * trusted edge, not the first which the client can forge).
 */
export function getClientIp(hdrs: Headers): string {
  return (
    hdrs.get("x-real-ip") ??
    hdrs.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown"
  );
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashRedis =
  upstashUrl && upstashToken
    ? new Redis({ url: upstashUrl, token: upstashToken })
    : null;

const memStore = new Map<string, { count: number; resetAt: number }>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function memCleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) memStore.delete(key);
  }
}

function memCheck(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  memCleanup(now);
  const entry = memStore.get(ip);
  if (!entry || now > entry.resetAt) {
    memStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// Cache Ratelimit instances po (limit, windowMs) — Upstash kreira novi
// sliding window per instance.
const upstashCache = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!upstashRedis) return null;
  const key = `${limit}:${windowMs}`;
  const cached = upstashCache.get(key);
  if (cached) return cached;
  // Minimum window granularnost je 1 sekunda — Upstash sliding window
  // ne podržava sub-second prozore. Sub-1000ms windowMs se zaokružuje na 1 s.
  const seconds = Math.max(1, Math.round(windowMs / 1000));
  const limiter = new Ratelimit({
    redis: upstashRedis,
    limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
    analytics: false,
    prefix: "up-beauty:rl",
  });
  upstashCache.set(key, limiter);
  return limiter;
}

/**
 * @returns `true` ako je zahtjev dozvoljen, `false` ako je rate-limited.
 */
export async function checkRateLimit(
  ip: string,
  limit = 10,
  windowMs = 60_000,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  const limiter = getUpstashLimiter(limit, windowMs);
  if (limiter) {
    try {
      const { success } = await limiter.limit(ip);
      return success;
    } catch {
      if (opts?.failClosed) return false;
      return memCheck(ip, limit, windowMs);
    }
  }
  return memCheck(ip, limit, windowMs);
}
