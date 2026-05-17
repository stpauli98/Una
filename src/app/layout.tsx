import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { BUSINESS } from "@/lib/constants/business";
import { BRAND_COLORS } from "@/lib/constants/theme";
import { CookieBanner } from "@/components/public/CookieBanner";
import { InstallPrompt } from "@/components/public/InstallPrompt";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  variable: "--font-dm",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: BRAND_COLORS.theme,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  manifest: "/manifest.webmanifest",
  title: {
    default: `Šminkanje Gradiška — ${BUSINESS.name}`,
    template: `%s · ${BUSINESS.name}`,
  },
  description:
    "Profesionalno šminkanje u Gradišci — svadbeno, večernje, maturalno, terensko. Pedikir, trepavice i obuka šminkanja kod Une Peranović u UP Beauty & Makeup Studio. Zakažite termin online.",
  applicationName: "UP Beauty",
  appleWebApp: {
    capable: true,
    title: "UP Beauty",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "sr_Latn",
    siteName: BUSINESS.name,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "UP Beauty & Makeup Studio" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr-Latn"
      data-scroll-behavior="smooth"
      className={`${cormorant.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-marble text-body">
        {children}
        <CookieBanner />
        <InstallPrompt />
      </body>
    </html>
  );
}
