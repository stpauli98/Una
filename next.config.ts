import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "127.0.0.1";
const isDev = process.env.NODE_ENV === "development";

// U dev mode-u Supabase je lokalni Docker na http://127.0.0.1:54321 (i ws://).
// U prod-u je https://<ref>.supabase.co (i wss://). CSP mora pokriti oba.
const supabaseImgSrc = isDev
  ? `http://${supabaseHostname}:54321 http://localhost:54321`
  : `https://${supabaseHostname}`;
const supabaseConnectSrc = isDev
  ? `http://${supabaseHostname}:54321 http://localhost:54321 ws://${supabaseHostname}:54321 ws://localhost:54321`
  : `https://${supabaseHostname} wss://${supabaseHostname}`;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              // Next.js inline runtime trenutno zahtijeva 'unsafe-inline' do nonce setup-a.
              // Report-Only mode — pratimo violations u browser konzoli prije enforce-a.
              // 'unsafe-eval' je samo u dev mode (Turbopack fast-refresh ga zahtijeva).
              // U prod buildu se izostavlja — strožija CSP i prije enforce iteracije.
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${supabaseImgSrc}`,
              `connect-src 'self' ${supabaseConnectSrc}`,
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
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
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    // Next 16 default-no dozvoljava samo q=75. Galerija šminkanja zahtijeva
    // čistije nijanse — eksplicitno otključavamo q=90 za portretne kadrove.
    qualities: [75, 90],
    // Next 16 default-no blokira optimizaciju slika sa privatnih IP-jeva (SSRF zaštita).
    // Lokalni Supabase Docker je na 127.0.0.1:54321 — bez ovoga `next/image` vraća 400.
    // Aktivno samo u dev — produkcija koristi javni supabase.co host i ne treba bypass.
    dangerouslyAllowLocalIP: isDev,
    remotePatterns: [
      {
        protocol: supabaseUrl?.startsWith("https") ? "https" : "http",
        hostname: supabaseHostname,
        port: supabaseHostname === "127.0.0.1" ? "54321" : "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
