import { BUSINESS } from "@/lib/constants/business";

/**
 * Schema.org LocalBusiness structured data za SEO.
 * Renderuje se na homepage-u (page.tsx).
 */
export function LocalBusinessJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const data = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    "@id": `${baseUrl}/#business`,
    name: BUSINESS.name,
    image: `${baseUrl}/opengraph-image`,
    url: baseUrl,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Majora Milana Tepića 13",
      addressLocality: "Gradiška",
      postalCode: "78400",
      addressCountry: "BA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: BUSINESS.geo.lat,
      longitude: BUSINESS.geo.lng,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        opens: "17:00",
        closes: "21:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday"],
        opens: "05:00",
        closes: "21:00",
      },
    ],
    priceRange: "40-800 BAM",
    sameAs: [BUSINESS.instagram, BUSINESS.tiktok],
    areaServed: {
      "@type": "City",
      name: "Gradiška",
    },
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
