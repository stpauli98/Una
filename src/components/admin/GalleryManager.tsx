"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { Trash2, Upload } from "lucide-react";
import {
  uploadGalleryImages,
  deleteGalleryImage,
} from "@/app/admin/(protected)/galerija/actions";
import { cn } from "@/lib/utils/cn";

type GalleryItem = {
  id: number;
  url: string;
  category: string;
  alt: string;
};

const CATEGORIES = [
  { key: "sminkanje", label: "Šminkanje" },
  { key: "svadbeno", label: "Svadbeno" },
  { key: "pedikir", label: "Pedikir" },
  { key: "trepavice", label: "Trepavice" },
] as const;

export function GalleryManager({ items }: { items: GalleryItem[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("sminkanje");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) => i.category === activeCategory);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                "whitespace-nowrap border px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors cursor-pointer",
                activeCategory === cat.key
                  ? "border-rose bg-rose text-white"
                  : "border-cream bg-white text-body hover:border-rose",
              )}
            >
              {cat.label} ({items.filter((i) => i.category === cat.key).length})
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            const fd = new FormData(e.currentTarget);
            fd.set("category", activeCategory);
            startTransition(async () => {
              const result = await uploadGalleryImages(fd);
              if (result.ok) {
                setMessage(
                  `Uspješno poslato ${result.data?.uploaded ?? 0} slika`,
                );
                if (fileInputRef.current) fileInputRef.current.value = "";
              } else {
                setError(result.error);
              }
            });
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            name="files"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            className="text-[12px]"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 bg-rose px-4 py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
          >
            <Upload size={12} />
            {pending ? "Šaljem..." : "Učitaj"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 border border-green-200 bg-green-50 p-3 text-xs text-green-700">
          {message}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="border border-cream bg-white p-10 text-center">
          <p className="text-sm text-light">
            Nema slika u kategoriji &ldquo;
            {CATEGORIES.find((c) => c.key === activeCategory)?.label}&rdquo;.
          </p>
          <p className="mt-1 text-[11px] text-light">
            Koristite dugme &ldquo;Učitaj&rdquo; iznad da dodate slike.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden border border-cream bg-white"
            >
              <Image
                src={item.url}
                alt={item.alt}
                fill
                sizes="(min-width:1024px) 240px, (min-width:768px) 33vw, 50vw"
                className="object-cover"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Obrisati ovu sliku? Ne može se vratiti.")) {
                    return;
                  }
                  startTransition(async () => {
                    const r = await deleteGalleryImage(item.id);
                    if (!r.ok) setError(r.error);
                  });
                }}
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100 disabled:opacity-60 cursor-pointer"
                aria-label="Obriši sliku"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
