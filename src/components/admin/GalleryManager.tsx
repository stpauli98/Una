"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Trash2, Upload, X, ImagePlus, Loader2 } from "lucide-react";
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

type PreviewFile = {
  file: File;
  previewUrl: string;
  name: string;
  sizeLabel: string;
};

const CATEGORIES = [
  { key: "sminkanje", label: "Šminkanje" },
  { key: "svadbeno", label: "Svadbeno" },
  { key: "pedikir", label: "Pedikir" },
  { key: "trepavice", label: "Trepavice" },
] as const;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf(".");
  if (ext > 0 && name.length - ext <= 5) {
    const base = name.slice(0, max - (name.length - ext) - 3);
    return `${base}...${name.slice(ext)}`;
  }
  return `${name.slice(0, max - 3)}...`;
}

export function GalleryManager({ items }: { items: GalleryItem[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("sminkanje");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) => i.category === activeCategory);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [previews]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) =>
      ACCEPTED_TYPES.includes(f.type),
    );
    if (files.length === 0) return;
    const newPreviews = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      sizeLabel: formatFileSize(file.size),
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, []);

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearPreviews = useCallback(() => {
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleUpload = () => {
    if (previews.length === 0) return;
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set("category", activeCategory);
    previews.forEach((p) => fd.append("files", p.file));
    startTransition(async () => {
      const result = await uploadGalleryImages(fd);
      if (result.ok) {
        setMessage(`Uspješno učitano ${result.data?.uploaded ?? 0} slika`);
        clearPreviews();
      } else {
        setError(result.error);
      }
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const hasPreview = previews.length > 0;

  return (
    <div>
      <div className="mb-5 flex gap-1.5 overflow-x-auto">
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

      {/* Upload zone */}
      <div className="mb-5">
        <input
          ref={fileInputRef}
          type="file"
          name="files"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
          }}
        />

        {!hasPreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragEnter={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 transition-all duration-200",
              dragOver
                ? "border-rose bg-rose/[0.04]"
                : "border-cream bg-warm/50 hover:border-rose/50 hover:bg-warm",
            )}
          >
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full transition-colors",
                dragOver ? "bg-rose/10 text-rose" : "bg-cream text-light",
              )}
            >
              <ImagePlus size={22} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-dark">
                Prevucite slike ovdje ili{" "}
                <span className="text-rose underline-offset-2 hover:underline">
                  kliknite za odabir
                </span>
              </p>
              <p className="mt-1 text-[11px] text-light">
                JPG, PNG ili WebP · Automatska kompresija na 1600px
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-cream bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-dark">
                {previews.length}{" "}
                {previews.length === 1 ? "slika izabrana" : "slika izabrano"} ·{" "}
                {CATEGORIES.find((c) => c.key === activeCategory)?.label}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending}
                className="text-[10px] text-rose underline-offset-2 hover:underline cursor-pointer"
              >
                + Dodaj još
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
              {previews.map((preview, i) => (
                <div key={preview.previewUrl} className="group relative">
                  <div className="relative aspect-square overflow-hidden border border-cream bg-marble">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.previewUrl}
                      alt={preview.name}
                      className={cn(
                        "size-full object-cover transition-opacity",
                        pending && "opacity-40",
                      )}
                    />
                    {pending && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2
                          size={18}
                          className="animate-spin text-rose"
                        />
                      </div>
                    )}
                    {!pending && (
                      <button
                        type="button"
                        onClick={() => removePreview(i)}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-dark/70 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                        aria-label="Ukloni"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 px-0.5">
                    <p className="truncate text-[9px] text-dark">
                      {truncateName(preview.name)}
                    </p>
                    <p className="text-[9px] text-light">{preview.sizeLabel}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleUpload}
                className="inline-flex flex-1 items-center justify-center gap-1.5 bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {pending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Šaljem... ({previews.length} slika)
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    Učitaj {previews.length}{" "}
                    {previews.length === 1 ? "sliku" : "slika"}
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={clearPreviews}
                className="border border-cream bg-white px-4 py-2.5 text-[11px] uppercase tracking-wider text-body hover:border-rose hover:text-rose disabled:opacity-40 cursor-pointer"
              >
                Otkaži
              </button>
            </div>
          </div>
        )}
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
            Koristite upload zonu iznad da dodate slike.
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
