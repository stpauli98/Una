"use client";

import Image from "next/image";
import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);

  const filtered =
    activeFilter === "sve"
      ? images
      : images.filter((img) => img.category === activeFilter);

  const lightboxOpen = lightboxIndex !== null;
  const currentImage = lightboxOpen ? filtered[lightboxIndex] : null;

  const goNext = useCallback(() => {
    setLightboxLoaded(false);
    setLightboxIndex((prev) =>
      prev !== null ? (prev + 1) % filtered.length : null,
    );
  }, [filtered.length]);

  const goPrev = useCallback(() => {
    setLightboxLoaded(false);
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + filtered.length) % filtered.length : null,
    );
  }, [filtered.length]);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handleKey);
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, goNext, goPrev, closeLightbox]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setActiveFilter(f.key);
                setLightboxIndex(null);
              }}
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
          {filtered.map((img, index) => (
            <div
              key={img.id}
              onClick={() => {
                setLightboxLoaded(false);
                setLightboxIndex(index);
              }}
              className="group relative aspect-square cursor-pointer overflow-hidden bg-cream animate-pulse"
              role="button"
              tabIndex={0}
              aria-label={`Pogledaj sliku: ${img.alt}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLightboxLoaded(false);
                  setLightboxIndex(index);
                }
              }}
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
                className="object-cover transition-all duration-500 group-hover:scale-105"
                onLoad={(e) => {
                  (e.target as HTMLElement)
                    .closest(".animate-pulse")
                    ?.classList.remove("animate-pulse");
                }}
              />
              <div className="absolute inset-0 bg-dark/0 transition-colors duration-300 group-hover:bg-dark/10" />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && currentImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/95 backdrop-blur-sm"
          onClick={closeLightbox}
          role="dialog"
          aria-label="Prikaz slike"
        >
          {/* Close */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer"
            aria-label="Zatvori"
          >
            <X size={20} strokeWidth={1.5} />
          </button>

          {/* Counter */}
          <div className="absolute left-4 top-4 z-10 text-[11px] tracking-wider text-white/50">
            {lightboxIndex + 1} / {filtered.length}
          </div>

          {/* Prev */}
          {filtered.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:left-6 cursor-pointer"
              aria-label="Prethodna"
            >
              <ChevronLeft size={22} strokeWidth={1.5} />
            </button>
          )}

          {/* Image */}
          <div
            className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center md:max-w-[80vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {!lightboxLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2
                  size={32}
                  className="animate-spin text-white/40"
                  strokeWidth={1.5}
                />
              </div>
            )}
            <Image
              src={currentImage.url}
              alt={currentImage.alt}
              width={1600}
              height={1200}
              className={cn(
                "max-h-[85vh] w-auto object-contain transition-opacity duration-300",
                lightboxLoaded ? "opacity-100" : "opacity-0",
              )}
              priority
              sizes="90vw"
              onLoad={() => setLightboxLoaded(true)}
            />
          </div>

          {/* Next */}
          {filtered.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:right-6 cursor-pointer"
              aria-label="Sljedeća"
            >
              <ChevronRight size={22} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
