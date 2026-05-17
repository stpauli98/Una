import type { MetadataRoute } from "next";
import { BUSINESS } from "@/lib/constants/business";
import { BRAND_COLORS } from "@/lib/constants/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BUSINESS.name} — Gradiška`,
    short_name: "UP Beauty",
    description:
      "Profesionalno šminkanje, pedikir i trepavice u Gradišci. Una Peranović — UP Beauty & Makeup Studio.",
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
}
