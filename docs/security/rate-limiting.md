# Rate limiting — Upstash Redis + fallback

**Fajl:** `src/lib/utils/rate-limit.ts`

Distribuirani rate limiter za sprjecavanje spam-a.

## Use cases

| Endpoint | Limit | Razlog |
|----------|-------|--------|
| `/api/availability` | 30/min/IP | Sprjecava scraping |
| `createAppointment` | 5/min/IP | Sprjecava booking spam |
| (Supabase login) | 30/5min/IP | Brute force |

Limit per IP, ne per user — anon korisnici nemaju nalog.

## Dva backend-a

### Production: Upstash Redis

Distribuirani — radi i na multi-region Vercel deploy-evima.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const upstashRedis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const limiter = new Ratelimit({
  redis: upstashRedis,
  limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
  prefix: "up-beauty:rl",
});

const { success } = await limiter.limit(ip);
```

### Fallback: In-memory Map

Za dev/test kad Upstash env vars nisu setovane.

```typescript
const memStore = new Map<string, { count: number; resetAt: number }>();

function memCheck(ip, limit, windowMs) {
  const now = Date.now();
  const entry = memStore.get(ip);
  if (!entry || now > entry.resetAt) {
    memStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}
```

**Limitacija:** Resetuje se na cold start. Ne dijeli stanje između Vercel instanca.

## Glavni API

```typescript
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
      return memCheck(ip, limit, windowMs);  // Fail-open na infrastructure error
    }
  }
  return memCheck(ip, limit, windowMs);
}
```

### Vraća

- `true` → request dozvoljen
- `false` → rate limited (vrati 429)

### `failClosed` opcija

Default je **fail-open** — ako Upstash padne, koristi in-memory fallback (request prolazi ako limit not exceeded).

`failClosed: true` znači **fail-closed** — ako Upstash error, request je rejected.

Trade-off:
- Fail-open: bolji UX, lošija sigurnost
- Fail-closed: bolja sigurnost, gori UX ako infra padne

UP Makeup koristi default fail-open jer nije visok security risk.

## IP detection

```typescript
export function getClientIp(hdrs: Headers): string {
  return (
    hdrs.get("x-real-ip") ??
    hdrs.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown"
  );
}
```

### Prefer `x-real-ip`

Vercel postavlja `x-real-ip` sa trusted edge IP-a. Ne može se spoof-ovati klijentom.

### `x-forwarded-for` — last entry

Ako `x-real-ip` nije postavljen, koristi `x-forwarded-for`:

```
x-forwarded-for: spoofed-by-client, real-client-ip, vercel-edge-ip
```

Klijent može dodati bilo šta na početak. Trusted edge dodaje stvarni IP na kraj.

**Uzimamo last entry** — to je trusted edge IP.

### Test

```typescript
// tests/unit/rate-limit.test.ts
test("uses last entry from x-forwarded-for when x-real-ip is absent", () => {
  const h = new Headers({
    "x-forwarded-for": "spoofed, 3.3.3.3",
  });
  expect(getClientIp(h)).toBe("3.3.3.3");
});
```

## Use u API ruti

```typescript
// src/app/api/availability/route.ts
export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  if (!(await checkRateLimit(ip, 30, 60_000))) {
    return new Response("Rate limited", { status: 429 });
  }
  
  // ... rest of route
}
```

## Use u server action

```typescript
// src/app/zakazi/actions.ts
import { headers } from "next/headers";
import { getClientIp, checkRateLimit } from "@/lib/utils/rate-limit";

export async function createAppointment(formData: FormData) {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  
  if (!(await checkRateLimit(ip, 5, 60_000))) {
    return { ok: false, error: "Previše zahtjeva. Pokušajte ponovo za minutu." };
  }
  
  // ... rest of action
}
```

## Upstash setup

### 1. Kreiraj Upstash Redis database

https://console.upstash.com → Create database → free tier.

### 2. Kopiraj REST URL i token

Database overview → REST API tab → kopiraj.

### 3. Postavi env vars

Vercel Dashboard → Settings → Environment Variables:

```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### 4. Redeploy

Vercel auto-redeploy na env var changes.

### 5. Verifikuj

Bilo koji rate-limited endpoint → 429 nakon limit exceeded.

## Limiti Upstash free tier

| Resource | Limit |
|----------|-------|
| Commands per day | 10,000 |
| Max DB size | 256 MB |
| Bandwidth | 1 GB/day |
| Concurrent connections | 1000 |

Za UP Makeup: ~100 booking/dan × 5 commands = ~500/day. Daleko ispod limita.

## Limit choice — pet po minutu za booking

Zašto 5?

| Scenarij | Use case |
|----------|----------|
| Una testira sa svog telefona | 5 dovoljno |
| Klijent pravi typo, pokusava 3x | 5 dovoljno |
| Botnet spam | 5 zaustavlja |

Ako legit klijent dobije 429, vrati se za 1 minut. Minimal friction.

## Limit choice — 30 per minute za availability

Klijent može više puta refresh-ovati kalendar. 30 dozvoljava.

Bot scraping (npr. neko pokuša da skene sve dane) → blokira ga.

## Sliding window vs fixed window

Upstash `Ratelimit.slidingWindow`:

```
Window:    [───── 60s ─────]
                    
Time:    -60s    -30s    now
Requests:  5      10     ?
```

Sliding: provjeri u zadnjih 60s, ako > 30 → reject.

Fixed window (alternativa): provjeri u current 60s "bucket", reset na sledeci.

Sliding je tačniji ali skupiji (1 Redis call). Mi koristimo sliding.

## Test

`tests/unit/rate-limit.test.ts` (8 testova):
- Under limit prolazi
- Over limit blokira
- IPs tracked nezavisno
- Window reset
- Default limit (10)
- `getClientIp` prefer x-real-ip
- `getClientIp` last x-forwarded-for entry
- `failClosed` opcija

## Edge cases

| Scenarij | Šta se desi |
|----------|-------------|
| Upstash konekcija padne | Fall back na in-memory (fail-open) |
| IP unknown | Tretira kao isti IP za sve unknown — moglo bi blokirati legitimne, ali rijetko |
| User sa dynamic IP | Različiti IP per session, limit ne pogađa istu osobu |
| User sa VPN | IP rotira, može lako zaobići |
| Multiple users iza NAT-a | Dijele isti IP, jedan može iscrpsti limit za sve |

NAT je known limitation. Mogli bismo dodati user-agent fingerprint ali to je over-engineering za skala UP Makeup-a.

## Sledeće

- [auth.md](./auth.md) — auth flow
- [headers.md](./headers.md) — HTTP security headers
