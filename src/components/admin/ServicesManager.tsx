"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Eye, EyeOff, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { ServiceForm } from "./ServiceForm";
import {
  toggleServiceActive,
  reorderService,
} from "@/app/admin/(protected)/usluge/actions";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

const CATEGORY_LABELS: Record<string, string> = {
  sminkanje: "Šminkanje",
  pedikir: "Pedikir",
  trepavice: "Trepavice",
  obuka: "Obuka",
};

export function ServicesManager({
  initialServices,
}: {
  initialServices: Service[];
}) {
  // BITNO: NE koristimo useState za listu, jer to zaledi snapshot. Server
  // action revalidatePath osvježi server prop, ali useState init samo jednom.
  // Direktno korišćenje props znači da se nakon router.refresh() lista
  // automatski ažurira sa svježim podacima iz baze.
  const services = initialServices;
  const router = useRouter();
  // Edit state drži samo ID, a stvarne podatke uzimamo iz svježe `services`
  // liste. Ovako se izbjegava da modal pokaže stari snapshot servisa.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing =
    editingId !== null
      ? (services.find((s) => s.id === editingId) ?? null)
      : null;

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 bg-rose px-4 py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover cursor-pointer"
        >
          <Plus size={14} />
          Nova usluga
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const priceDisplay =
            service.price_note ?? formatPrice(Number(service.price));
          const durationDisplay =
            service.duration_note ?? formatDuration(service.duration_min);

          return (
            <div
              key={service.id}
              className={`border bg-white p-5 transition-opacity ${
                service.active
                  ? "border-cream"
                  : "border-stone-200 opacity-50"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-rose">
                    {CATEGORY_LABELS[service.category]}
                  </p>
                  <h3 className="font-display text-lg text-dark">
                    {service.name}
                  </h3>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await reorderService(service.id, "up");
                        router.refresh();
                      })
                    }
                    aria-label="Pomjeri gore"
                    className="flex size-7 items-center justify-center text-light hover:text-rose cursor-pointer"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await reorderService(service.id, "down");
                        router.refresh();
                      })
                    }
                    aria-label="Pomjeri dole"
                    className="flex size-7 items-center justify-center text-light hover:text-rose cursor-pointer"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>

              {service.description && (
                <p className="mb-3 line-clamp-2 text-[12px] text-light">
                  {service.description}
                </p>
              )}

              <div className="mb-4 flex items-baseline justify-between">
                <span className="font-display text-xl text-rose">
                  {priceDisplay}
                </span>
                <span className="text-[11px] text-light">
                  {durationDisplay}
                </span>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingId(service.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 border border-cream bg-white px-3 py-2 text-[10px] uppercase tracking-wider text-dark hover:border-rose hover:text-rose cursor-pointer"
                >
                  <Edit2 size={11} />
                  Izmijeni
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleServiceActive(service.id, !service.active);
                      router.refresh();
                    })
                  }
                  className="inline-flex items-center justify-center gap-1 border border-cream bg-white px-3 py-2 text-[10px] uppercase tracking-wider text-dark hover:border-rose hover:text-rose cursor-pointer"
                >
                  {service.active ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(editing || creating) && (
        <ServiceForm
          service={editing}
          onClose={() => {
            setEditingId(null);
            setCreating(false);
          }}
          onSaved={() => {
            // Forsiraj RSC re-fetch tako da se nova lista propagira u props.
            // revalidatePath sam za sebe ne sync-uje klijentske komponente
            // koje već postoje u DOM-u — treba router.refresh().
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
