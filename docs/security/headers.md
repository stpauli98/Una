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
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Content-Security-Policy", value: "..." }, // vidi CSP sekciju ispod
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

Plus `experimental.serverActions.bodySizeLimit: "6mb"` — server action payload limit (chunked gallery upload šalje jednu sliku po pozivu, pa 6 MB pokriva najveću pojedinačnu sliku).

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

### `Strict-Transport-Security: max-age=31536000; includeSubDomains`

HSTS — naš header (postavljen u `next.config.ts`, ne oslanja se na Vercel). Browser pamti 1 godinu da se upmakeup.ba smije otvarati SAMO preko HTTPS-a; svaki `http://` pokušaj se auto-upgrade-uje prije slanja request-a.

`preload` direktiva namjerno izostavljena — preload lista je praktično nepovratna, a domen je tek registrovan.

**Sprjecava:** SSL-strip / downgrade napade na javnim WiFi mrežama.

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
| `Cache-Control` | Per-resource (HTML, JSON, etc.) |
| `Server` | `Vercel` |
| `X-Vercel-Cache` | `HIT`/`MISS`/`STALE` (debug) |

HSTS NE prepuštamo Vercelu — eksplicitno je naš header u `next.config.ts` (vidi gore), da vrijednost bude ista na svakom hostingu.

## CSP (Content Security Policy)

**Implementiran** u `next.config.ts` (commit `0b5836e`). Direktive:

| Direktiva | Vrijednost | Zašto |
|-----------|-----------|-------|
| `default-src` | `'self'` | Sve default-no samo sa našeg origin-a |
| `script-src` | `'self' 'unsafe-inline'` (prod) | Next.js inline runtime još zahtijeva `unsafe-inline` (do nonce setup-a); `'unsafe-eval'` SAMO u dev (Turbopack fast-refresh) |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind/inline styles |
| `img-src` | `'self' data: blob: https://<ref>.supabase.co` | Galerija slike sa Supabase Storage |
| `connect-src` | `'self' https://<ref>.supabase.co wss://<ref>.supabase.co` | Supabase API + Realtime WebSocket |
| `font-src` | `'self' data:` | Lokalni fontovi |
| `worker-src` | `'self' blob:` | Service worker (PWA) |
| `manifest-src` | `'self'` | PWA manifest |
| `frame-ancestors` | `'none'` | Dupli sloj uz X-Frame-Options |
| `base-uri` | `'self'` | Sprjecava `<base>` hijack |
| `form-action` | `'self'` | Forme se submituju samo na naš origin |

Supabase host se računa dinamički iz `NEXT_PUBLIC_SUPABASE_URL` — dev pokriva lokalni Docker (`http://127.0.0.1:54321` + `ws://`), prod pokriva `https://<ref>.supabase.co` + `wss://`.

**Poznati trade-off:** `'unsafe-inline'` u `script-src` slabi XSS zaštitu CSP-a. Sljedeća iteracija: nonce-based CSP kad Next.js setup to dozvoli bez breaking hydration.

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
