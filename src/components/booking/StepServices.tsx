"use client";

import { Info } from "lucide-react";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  services: Service[];
  onSelect: (service: Service) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  sminkanje: "Šminkanje",
  pedikir: "Pedikir",
  trepavice: "Trepavice",
};

const CATEGORY_ORDER = ["sminkanje", "pedikir", "trepavice"] as const;

export function StepServices({ services, onSelect }: Props) {
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="mb-2 font-display text-3xl font-light text-dark md:text-4xl">
          Izaberite uslugu
        </h2>
        <p className="text-[13px] text-light">
          Kliknite na karticu da biste nastavili na izbor termina.
        </p>
      </div>

      <div className="mx-auto max-w-[760px] space-y-10">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items?.length) return null;
          return (
            <div key={cat}>
              <h3 className="mb-4 text-center font-display text-xl text-dark">
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((service) => (
                  <ServiceOption
                    key={service.id}
                    service={service}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServiceOption({
  service,
  onSelect,
}: {
  service: Service;
  onSelect: (service: Service) => void;
}) {
  const priceDisplay = service.price_note ?? formatPrice(Number(service.price));
  const durationDisplay =
    service.duration_note ?? formatDuration(service.duration_min);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(service)}
        className={cn(
          "flex w-full items-center justify-between gap-4 border border-cream bg-white p-5 text-left transition-all cursor-pointer",
          "hover:border-rose hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose",
        )}
      >
        <div className="flex-1">
          <h4 className="mb-1 font-display text-lg font-medium text-dark">
            {service.name}
          </h4>
          <p className="text-[11px] uppercase tracking-wider text-light">
            {durationDisplay}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-normal text-rose">
            {priceDisplay}
          </p>
        </div>
      </button>
      {service.variable_price && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-light">
          <Info size={12} className="mt-0.5 shrink-0" strokeWidth={1.5} />
          <span>
            Cijena je okvirna. Una će vas kontaktirati nakon rezervacije radi
            potvrde tačne cijene.
          </span>
        </div>
      )}
    </div>
  );
}
