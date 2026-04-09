"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

type GalleryImage = {
  id: number;
  url: string;
  category: string;
  alt: string;
};

const FILTERS = [
  { key: "sve", label: "Sve" },
  { key: "sminkanje", label: "Šminkanje" },
  { key: "svadbeno", label: "Svadbeno" },
  { key: "pedikir", label: "Pedikir" },
  { key: "trepavice", label: "Trepavice" },
] as const;

type Props = {
  images: GalleryImage[];
};

export function GalleryGrid({ images }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>("sve");

  const filtered =
    activeFilter === "sve"
      ? images
      : images.filter((img) => img.category === activeFilter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "border px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition-colors cursor-pointer",
                active
                  ? "border-rose bg-rose text-white"
                  : "border-blush bg-transparent text-body hover:border-rose hover:text-rose",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-light">
          Uskoro ćete ovdje vidjeti slike radova. Pratite{" "}
          <a
            href="https://instagram.com/_upmakeup._"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose hover:underline"
          >
            Instagram
          </a>{" "}
          za najnovije.
        </p>
      ) : (
        <div className="mx-auto grid max-w-[480px] grid-cols-2 gap-1.5 md:max-w-[760px] md:grid-cols-3 md:gap-2.5 lg:max-w-[960px] lg:grid-cols-4">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden"
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="(min-width:1024px) 240px, (min-width:768px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
