# HTTP security headers

Set headers koji štite od XSS, clickjacking, MIME sniffing, itd.

## Konfiguracija

**Fajl:** `next.config.ts`

```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
    {
      source: "/favicon.ico",
      headers: [
        { key: "Cache-Control", value: "public, max-age=2592000, immutable" },
      ],
    },
    {
      source: "/:path*.svg",
      headers: [
        { key: "Cache-Control", value: "public, max-age=2592000, immutable" },
      ],
    },
  ];
}
```

## Šta svaki radi

### `X-Frame-Options: DENY`

Sprjecava da bilo koji site učita upmakeup.ba u `<iframe>`.

**Sprjecava:** Clickjacking attack — napadač pravi malicious site sa `<iframe src="upmakeup.ba/admin/...">` da prevari Unu.

Alternativa: `SAMEORIGIN` (samo upmakeup.ba može frame). Mi koristimo `DENY` (niko ne može) jer ne trebamo embed.

### `X-Content-Type-Options: nosniff`

Browser ne smije "njuškati" MIME tip — koristi Content-Type header doslovno.

**Sprjecava:** Browser pomisli da je `image.jpg` zapravo HTML (jer sadrži `<script>`) i izvrši ga.

Standardna best practice za sve sajtove.

### `Referrer-Policy: strict-origin-when-cross-origin`

Šta se šalje u `Referer` header kad klijent klikne link na drugi sajt:

- Same-origin: full URL
- Cross-origin HTTPS → HTTPS: samo origin (`https://upmakeup.ba`)
- HTTPS → HTTP: ništa (downgrade)

**Sprjecava:** Leak osjetljivih URL-ova (npr. `/zakazi/uspjesno?token=...`) na third-party sajtove.

### `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Klijent ne može trazati pristup kameri, mikrofonu ili lokaciji. Sajt to ne treba.

**Sprjecava:** Embedded malicious script trazi kameru. Ako Una slučajno klikne "Allow" → kompromitovan privacy.

## Cache headers

| Path | Cache-Control |
|------|---------------|
| `/favicon.ico` | `public, max-age=2592000, immutable` (30 dana) |
| `*.svg` | `public, max-age=2592000, immutable` (30 dana) |
| `/_next/static/*` | Next.js auto: `public, max-age=31536000, immutable` (1 god) |

`immutable` znaci browser ne treba revalidate. Failsafe — ne mijenja se favicon.

## Vercel automatski headers

Vercel dodaje na produkciji:

| Header | Vrijednost |
|--------|-----------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (HSTS 2 god) |
| `Cache-Control` | Per-resource (HTML, JSON, etc.) |
| `Server` | `Vercel` |
| `X-Vercel-Cache` | `HIT`/`MISS`/`STALE` (debug) |

HSTS forsira HTTPS na 2 godine. Ako klijent ikad poseti `http://upmakeup.ba`, browser auto-redirect na HTTPS bez ulaska na unsecure.

## CSP (Content Security Policy)

**Trenutno nije implementiran.**

CSP bi dodatno ograničio koje resource-e browser smije load-ovati:

```
Content-Security-Policy: default-src 'self'; img-src 'self' https://*.supabase.co; script-src 'self'; ...
```

Razlozi za neimplementirati trenutno:
- Komplikovano sa Next.js (inline scripts za hydration)
- Strict mode breakuje Google Maps embed
- Trade-off vs implementation overhead

Mogući upgrade: implementirati CSP report-only mode da vidimo violations bez breaking site-a.

## CORS

Trenutno: same-origin policy default. Klijenti sa upmakeup.ba mogu fetch `/api/*`, drugi ne.

Bez CORS headers u next.config, drugi origin-i ne mogu pristupiti API-jima.

Razlog za defaultne settinge:
- Sajt nije API server
- Samo internal client (Next.js app) pristupa API-jima

Ako bi se trebao otvoriti API (npr. integration sa drugim sajtom), trebalo bi `Access-Control-Allow-Origin` header.

## Verify headers

### Manual

```bash
curl -I https://upmakeup.ba
```

Provjeriti X-Frame-Options, X-Content-Type-Options, itd.

### Online tool

https://securityheaders.com → unesi `upmakeup.ba` → security score.

Target: A+ rating (svi headers).

## Test

`tests/e2e/security-headers.spec.ts`:

```typescript
test("X-Frame-Options is DENY", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});

test("X-Content-Type-Options is nosniff", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

// ... slično za ostalo
```

## Edge cases

| Situacija | Šta se desi |
|-----------|-------------|
| Browser pokuša embed kao `<iframe>` | DENY blokira |
| Klijent na HTTP-u | HSTS auto-upgrade na HTTPS |
| MIME mismatch | nosniff sprjecava izvršenje |
| Klijent klikne external link | Referrer-Policy ograničava info leak |
| Site pokuša pristup mikrofonu | Permissions-Policy blokira |
