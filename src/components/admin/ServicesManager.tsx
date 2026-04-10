"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Eye, EyeOff, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { ServiceForm } from "./ServiceForm";
import {
  toggleServiceActive,
  reorderService,
} from "@/app/admin/(protected)/usluge/actions";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
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
  const services = initialServices;
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lastMovedId, setLastMovedId] = useState<number | null>(null);
  const editing =
    editingId !== null
      ? (services.find((s) => s.id === editingId) ?? null)
      : null;

  // Automatski clear highlight nakon animacije
  useEffect(() => {
    if (lastMovedId === null) return;
    const timer = setTimeout(() => setLastMovedId(null), 800);
    return () => clearTimeout(timer);
  }, [lastMovedId]);

  const handleReorder = (id: number, direction: "up" | "down") => {
    startTransition(async () => {
      await reorderService(id, direction);
      router.refresh();
      setLastMovedId(id);
    });
  };

  return (
    <div>
      <style>{`
        @keyframes cardMoved {
          0% { transform: scale(1); box-shadow: none; }
          30% { transform: scale(1.02); box-shadow: 0 0 0 2px #C4787A40; }
          100% { transform: scale(1); box-shadow: none; }
        }
        .card-just-moved {
          animation: cardMoved 0.6s ease-out;
          border-color: #C4787A !important;
          background: linear-gradient(135deg, #fff 0%, #FDF0F0 100%);
        }
      `}</style>

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
        {services.map((service, index) => {
          const priceDisplay =
            service.price_note ?? formatPrice(Number(service.price));
          const durationDisplay =
            service.duration_note ?? formatDuration(service.duration_min);
          const justMoved = lastMovedId === service.id;
          const isFirst = index === 0;
          const isLast = index === services.length - 1;

          return (
            <div
              key={service.id}
              className={cn(
                "border bg-white p-5 transition-all duration-300",
                service.active
                  ? "border-cream"
                  : "border-stone-200 opacity-50",
                justMoved && "card-just-moved",
              )}
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
                    disabled={pending || isFirst}
                    onClick={() => handleReorder(service.id, "up")}
                    aria-label="Pomjeri gore"
                    title="Pomjeri gore u redoslijedu"
                    className={cn(
                      "flex size-7 items-center justify-center transition-colors cursor-pointer",
                      isFirst
                        ? "text-cream cursor-not-allowed"
                        : "text-light hover:text-rose hover:bg-warm rounded",
                    )}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={pending || isLast}
                    onClick={() => handleReorder(service.id, "down")}
                    aria-label="Pomjeri dole"
                    title="Pomjeri dole u redoslijedu"
                    className={cn(
                      "flex size-7 items-center justify-center transition-colors cursor-pointer",
                      isLast
                        ? "text-cream cursor-not-allowed"
                        : "text-light hover:text-rose hover:bg-warm rounded",
                    )}
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
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
