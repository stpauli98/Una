import Link from "next/link";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  service: Service;
  /** Ako true, prikaži sa većim paddingom i linkom na /zakazi */
  featured?: boolean;
};

const ICONS: Record<string, string> = {
  sminkanje: "✧",
  pedikir: "◈",
  trepavice: "❋",
  obuka: "◇",
};

export function ServiceCard({ service, featured }: Props) {
  const icon = ICONS[service.category] ?? "✧";
  const priceDisplay = service.price_note ?? formatPrice(Number(service.price));

  const content = (
    <>
      <div className="flex min-h-[120px] items-center justify-center bg-gradient-to-br from-blush to-pink">
        <span className="text-[36px] font-light text-white/70">{icon}</span>
      </div>
      <div className="p-5 md:p-6">
        <h3 className="mb-2 font-display text-xl font-normal text-dark">
          {service.name}
        </h3>
        {service.description && (
          <p className="mb-4 text-xs leading-relaxed text-light">
            {service.description}
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[26px] font-normal text-rose">
            {priceDisplay}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-light">
            {service.duration_note ?? formatDuration(service.duration_min)}
          </span>
        </div>
      </div>
    </>
  );

  const card = (
    <article
      className={`h-full overflow-hidden border border-cream bg-white transition-all duration-300 ${
        featured ? "hover:-translate-y-1 hover:shadow-lg" : ""
      }`}
    >
      {content}
    </article>
  );

  if (featured && service.bookable) {
    return (
      <Link href="/zakazi" aria-label={`Zakaži ${service.name}`}>
        {card}
      </Link>
    );
  }
  return card;
}
