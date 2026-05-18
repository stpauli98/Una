import { normalizeSiteUrl } from "@/lib/utils/site-url";

export type BreadcrumbItem = {
  /** Human-readable name (e.g. "Usluge"). Becomes ListItem.name. */
  name: string;
  /** Site-relative path (e.g. "/usluge", "/"). Resolved against siteUrl. */
  path: string;
};

export type BreadcrumbsJsonLd = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

/**
 * Gradi Schema.org BreadcrumbList sa svakim segmentom kao ListItem.
 * Google koristi ovo za breadcrumb prikaz u SERP-u (umjesto sirovog URL path-a).
 *
 * `siteUrl` se normalizuje preko `normalizeSiteUrl` — defensive protiv
 * Vercel env var-ova sa trailing whitespace-om (vidi memory project-up-beauty-vercel-env-newlines).
 *
 * Item URL je apsolutni (Schema.org očekuje URL string, ne relative path).
 * Korijenska putanja "/" daje siteUrl + "/" — npr. "https://up-beauty.vercel.app/".
 */
export function buildBreadcrumbsJsonLd(
  items: BreadcrumbItem[],
  siteUrl: string,
): BreadcrumbsJsonLd {
  const base = normalizeSiteUrl(siteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.path === "/" ? `${base}/` : `${base}${it.path}`,
    })),
  };
}
