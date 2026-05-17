import type { MetadataRoute } from "next";
import { BUSINESS } from "@/lib/constants/business";

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
    background_color: "#faf7f2",
    theme_color: "#3d2b2b",
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
