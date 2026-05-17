import type { Metadata } from "next";

/**
 * Admin segment-level layout.
 *
 * Sjedi IZNAD `(protected)` route group i `login` page, pa pokriva
 * sve `/admin/*` rute (login + dashboard + ostale protected stranice).
 *
 * Single purpose: override metadata fields tako da svaka admin stranica
 * linka admin-specific manifest, ima "UP Admin" kao iOS home-screen title,
 * i "UP Beauty Admin" kao application-name. Next 16 metadata-merge logika
 * uzima nested vrijednosti i prebriše field-by-field — sve OSTALO iz
 * root layout-a (viewport, themeColor, openGraph itd.) ostaje netaknuto.
 *
 * Renderira `{children}` bez ikakvog UI wrapper-a — nikakvi vidljivi
 * elementi se ovdje ne dodaju, samo metadata override.
 */
export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  applicationName: "UP Beauty Admin",
  appleWebApp: {
    capable: true,
    title: "UP Admin",
    statusBarStyle: "black-translucent",
  },
  title: {
    default: "Admin · UP Beauty",
    template: "%s · UP Admin",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
