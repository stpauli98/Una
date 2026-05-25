import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "@/lib/constants/theme";
import { BUSINESS } from "@/lib/constants/business";

/**
 * Public Web App Manifest (customer-facing PWA).
 *
 * Migrirano sa file-based `src/app/manifest.ts` na route handler jer
 * Next 16 file-based metadata ima viši prioritet od layout
 * `metadata.manifest` override-a. To je sprečavalo admin segment-layout
 * da efektivno preusmeri admin korisnike na /admin/manifest.webmanifest
 * u produkciji.
 *
 * Sa oba manifest-a kao route handler-i, root layout postavlja
 * metadata.manifest = "/manifest.webmanifest" a admin layout
 * (src/app/admin/layout.tsx) postavlja "/admin/manifest.webmanifest"
 * — Next 16 metadata-merge logika sada radi po očekivanjima.
 */
export function GET() {
  const manifest: MetadataRoute.Manifest = {
    name: `${BUSINESS.name} — Gradiška`,
    short_name: "UP Makeup",
    description:
      "Profesionalno šminkanje, pedikir i trepavice u Gradišci. Una Peranović — UP Makeup.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_COLORS.background,
    theme_color: BRAND_COLORS.theme,
    lang: "sr-Latn",
    dir: "ltr",
    categories: ["lifestyle", "beauty"],
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
