import { buildServicesJsonLd } from "@/lib/seo/services-jsonld";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  services: Service[];
  siteUrl: string;
};

/**
 * Renders Schema.org `ItemList` of `Service` items kao
 * <script type="application/ld+json"> u <head>. Mount-uje se na /usluge
 * (Server Component) i koristi isti services result koji stranica već
 * fetch-uje — nema duplog query-ja.
 *
 * Pattern mirror LocalBusinessJsonLd.tsx (dangerouslySetInnerHTML).
 */
export function ServicesJsonLd({ services, siteUrl }: Props) {
  const data = buildServicesJsonLd(services, siteUrl);
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
