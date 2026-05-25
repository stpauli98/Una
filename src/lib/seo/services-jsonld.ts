import type { Database } from "@/types/database";
import { normalizeSiteUrl } from "@/lib/utils/site-url";

type Service = Database["public"]["Tables"]["services"]["Row"];

/**
 * Mapira category enum na ljudski-čitljivu Schema.org `serviceType` vrijednost.
 * `obuka` se eksplicitno proširuje na "Obuka šminkanja" da bi bilo razumljivo
 * van konteksta (Schema.org polje stoji samostalno u Google rich results).
 */
const CATEGORY_LABELS: Record<string, string> = {
  sminkanje: "Šminkanje",
  pedikir: "Pedikir",
  trepavice: "Trepavice",
  obuka: "Obuka šminkanja",
};

function categoryLabel(category: Service["category"]): string {
  return CATEGORY_LABELS[category] ?? category;
}

type Offer = {
  "@type": "Offer";
  priceCurrency: "BAM";
  availability: "https://schema.org/InStock";
  url: string;
  price?: number;
  priceSpecification?: {
    "@type": "PriceSpecification";
    priceCurrency: "BAM";
    description: string;
  };
};

function buildOffer(s: Service, siteUrl: string): Offer | null {
  const url = s.bookable ? `${siteUrl}/zakazi?service=${s.id}` : `${siteUrl}/usluge`;
  // Variable-price ili NULL price: ako postoji price_note, koristi
  // priceSpecification sa tekstom; bez price_note nemamo šta da kažemo o cijeni
  // pa nema smisla emitovati Offer (Google će odbaciti Offer bez price/priceSpec).
  if (s.variable_price || s.price === null) {
    if (!s.price_note) return null;
    return {
      "@type": "Offer",
      priceCurrency: "BAM",
      availability: "https://schema.org/InStock",
      url,
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "BAM",
        description: s.price_note,
      },
    };
  }
  return {
    "@type": "Offer",
    price: s.price,
    priceCurrency: "BAM",
    availability: "https://schema.org/InStock",
    url,
  };
}

type ServiceItem = {
  "@type": "Service";
  "@id": string;
  name: string;
  serviceType: string;
  category: string;
  areaServed: { "@type": "City"; name: string };
  provider: { "@id": string };
  description?: string;
  estimatedDuration?: string;
  offers?: Offer;
};

function buildServiceItem(s: Service, siteUrl: string): ServiceItem {
  const label = categoryLabel(s.category);
  const item: ServiceItem = {
    "@type": "Service",
    "@id": `${siteUrl}/usluge#service-${s.id}`,
    name: s.name,
    serviceType: label,
    category: label,
    areaServed: { "@type": "City", name: "Gradiška" },
    provider: { "@id": `${siteUrl}/#business` },
  };
  if (s.description) item.description = s.description;
  if (s.duration_min) item.estimatedDuration = `PT${s.duration_min}M`;
  const offer = buildOffer(s, siteUrl);
  if (offer) item.offers = offer;
  return item;
}

export type ServicesJsonLd = {
  "@context": "https://schema.org";
  "@type": "ItemList";
  name: string;
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    item: ServiceItem;
  }>;
};

/**
 * Gradi Schema.org ItemList sa svim aktivnim uslugama kao ListItem-ima.
 * Svaki Service linka nazad na BeautySalon (LocalBusinessJsonLd) preko
 * `provider.@id` — tako Google povezuje entitete u jedan graf.
 *
 * `siteUrl` se normalizuje preko `normalizeSiteUrl` (skida trailing
 * whitespace + slash) — defensive protiv Vercel env var-ova koji znaju
 * uključiti literalni `\n` na kraju iz copy-paste-a.
 */
export function buildServicesJsonLd(services: Service[], siteUrl: string): ServicesJsonLd {
  const base = normalizeSiteUrl(siteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Usluge UP Makeup u Gradišci",
    itemListElement: services.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildServiceItem(s, base),
    })),
  };
}
