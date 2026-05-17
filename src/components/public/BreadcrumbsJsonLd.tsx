import { buildBreadcrumbsJsonLd, type BreadcrumbItem } from "@/lib/seo/breadcrumbs-jsonld";

type Props = {
  items: BreadcrumbItem[];
  siteUrl: string;
};

/**
 * Renders Schema.org BreadcrumbList kao <script type="application/ld+json">.
 * Server Component. Mirrors ServicesJsonLd / LocalBusinessJsonLd pattern.
 *
 * Mount-uje se na non-home pages (homepage NEMA breadcrumbe jer je root sam).
 * Svaka stranica passa svoj trail npr. [{name:"Početna",path:"/"},{name:"Usluge",path:"/usluge"}].
 */
export function BreadcrumbsJsonLd({ items, siteUrl }: Props) {
  const data = buildBreadcrumbsJsonLd(items, siteUrl);
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
