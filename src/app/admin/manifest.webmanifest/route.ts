import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "@/lib/constants/theme";

/**
 * Admin-scoped Web App Manifest.
 *
 * Razlika od root manifest-a (src/app/manifest.ts):
 *  - start_url: "/admin/dashboard" → instalirana app uvijek otvara admin
 *  - scope: "/admin" → standalone mode samo unutar admin namespace-a
 *  - id: "/admin" → browser-i tretiraju ovo kao zasebnu PWA (Una može imati i public i admin install paralelno)
 *  - name/short_name: "UP Beauty Admin" / "UP Admin" → distinkcija na home screen-u
 *  - icons: referenciraju admin-specific routes (src/app/admin/icon.tsx, icon1.tsx)
 *
 * Override <link rel="manifest"> dolazi iz src/app/admin/layout.tsx
 * koji u metadata.manifest postavlja "/admin/manifest.webmanifest".
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    id: "/admin",
    name: "UP Beauty Admin",
    short_name: "UP Admin",
    description:
      "Admin panel za UP Beauty & Makeup Studio — upravljanje terminima, uslugama i galerijom.",
    start_url: "/admin/dashboard",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_COLORS.background,
    theme_color: BRAND_COLORS.theme,
    lang: "sr-Latn",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      { src: "/admin/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/admin/icon1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
