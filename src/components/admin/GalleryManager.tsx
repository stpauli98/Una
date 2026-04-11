"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Trash2, Upload, X, ImagePlus, Loader2, CheckSquare, Square, Check } from "lucide-react";
import {
  uploadSingleGalleryImage,
  revalidateGallery,
  deleteGalleryImage,
  deleteGalleryImages,
} from "@/app/admin/(protected)/galerija/actions";
import { cn } from "@/lib/utils/cn";
import imageCompression from "browser-image-compression";

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
const MAX_IMAGES = 20;

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

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
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) => i.category === activeCategory);

  // Reset selekcije pri promjeni kategorije
  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((i) => i.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Obrisati ${selectedIds.size} ${selectedIds.size === 1 ? "sliku" : "slika"}? Ne može se vratiti.`,
      )
    )
      return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await deleteGalleryImages(Array.from(selectedIds));
      if (r.ok) {
        setMessage(`Obrisano ${r.data?.deleted ?? 0} slika`);
        exitSelectMode();
      } else {
        setError(r.error);
      }
    });
  };

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [previews]);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) =>
        ACCEPTED_TYPES.includes(f.type),
      );
      if (files.length === 0) return;

      // Enforce max images limit
      const remaining = MAX_IMAGES - previews.length;
      if (remaining <= 0) {
        setError(`Maksimalno ${MAX_IMAGES} slika po uploadu`);
        return;
      }
      const toProcess = files.slice(0, remaining);
      if (toProcess.length < files.length) {
        setError(
          `Dodano ${toProcess.length} od ${files.length} — limit je ${MAX_IMAGES} slika`,
        );
      }

      setCompressing(true);
      try {
        const compressed = await Promise.all(
          toProcess.map(async (file) => {
            try {
              return await imageCompression(file, COMPRESSION_OPTIONS);
            } catch {
              console.warn(
                `Kompresija neuspješna za ${file.name}, preskačem`,
              );
              return null;
            }
          }),
        );
        const valid = compressed.filter((f): f is File => f !== null);
        if (valid.length === 0) return;
        const newPreviews = valid.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
          sizeLabel: formatFileSize(file.size),
        }));
        setPreviews((prev) => [...prev, ...newPreviews]);
      } finally {
        setCompressing(false);
      }
    },
    [previews.length],
  );

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

  const handleUpload = async () => {
    if (previews.length === 0) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    setUploadProgress({ current: 0, total: previews.length });

    let uploaded = 0;
    let failed = 0;

    for (let i = 0; i < previews.length; i++) {
      setUploadProgress({ current: i + 1, total: previews.length });
      const fd = new FormData();
      fd.set("category", activeCategory);
      fd.set("file", previews[i].file);
      try {
        const result = await uploadSingleGalleryImage(fd);
        if (result.ok) uploaded++;
        else failed++;
      } catch {
        failed++;
      }
    }

    await revalidateGallery();
    setUploadProgress(null);
    setUploading(false);
    clearPreviews();

    if (failed === 0) {
      setMessage(`Uspješno učitano ${uploaded} slika`);
    } else if (uploaded > 0) {
      setError(`Učitano ${uploaded}, neuspjelo ${failed} slika`);
    } else {
      setError("Nije uspjelo slanje ni jedne slike");
    }
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
            onClick={() => handleCategoryChange(cat.key)}
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

        {compressing && !hasPreview ? (
          <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-rose/50 bg-rose/[0.03] px-6 py-10">
            <Loader2 size={24} className="animate-spin text-rose" />
            <p className="text-[13px] font-medium text-dark">
              Kompresija slika...
            </p>
            <p className="text-[11px] text-light">
              Slike se automatski smanjuju za brži upload
            </p>
          </div>
        ) : !hasPreview ? (
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
                JPG, PNG ili WebP · Kompresija na 1600px WebP · Max {MAX_IMAGES} slika
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
                disabled={uploading || compressing || previews.length >= MAX_IMAGES}
                className="text-[10px] text-rose underline-offset-2 hover:underline cursor-pointer disabled:opacity-40"
              >
                + Dodaj još {previews.length >= MAX_IMAGES && `(max ${MAX_IMAGES})`}
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

            {/* Progress bar during upload */}
            {uploadProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-dark">
                    Šaljem {uploadProgress.current}/{uploadProgress.total}...
                  </span>
                  <span className="text-light">
                    {Math.round(
                      (uploadProgress.current / uploadProgress.total) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full bg-rose transition-all duration-300"
                    style={{
                      width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Upload / Cancel buttons */}
            {!uploadProgress && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={uploading || compressing}
                  onClick={handleUpload}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <Upload size={12} />
                  Učitaj {previews.length}{" "}
                  {previews.length === 1 ? "sliku" : "slika"}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={clearPreviews}
                  className="border border-cream bg-white px-4 py-2.5 text-[11px] uppercase tracking-wider text-body hover:border-rose hover:text-rose disabled:opacity-40 cursor-pointer"
                >
                  Otkaži
                </button>
              </div>
            )}
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

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          {selectMode ? (
            <>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="font-medium text-dark">
                  {selectedIds.size}{" "}
                  {selectedIds.size === 1 ? "izabrana" : "izabrano"}
                </span>
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={pending}
                  className="text-rose underline-offset-2 hover:underline cursor-pointer"
                >
                  Izaberi sve ({filtered.length})
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={pending || selectedIds.size === 0}
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1 bg-red-600 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 size={11} />
                  Obriši ({selectedIds.size})
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={exitSelectMode}
                  className="border border-cream bg-white px-3 py-1.5 text-[10px] uppercase tracking-wider text-body hover:border-rose cursor-pointer"
                >
                  Otkaži
                </button>
              </div>
            </>
          ) : (
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="inline-flex items-center gap-1 border border-cream bg-white px-3 py-1.5 text-[10px] uppercase tracking-wider text-body hover:border-rose hover:text-rose cursor-pointer"
              >
                <CheckSquare size={11} />
                Izaberi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gallery grid */}
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
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={selectMode ? () => toggleSelect(item.id) : undefined}
                className={cn(
                  "group relative aspect-square overflow-hidden border bg-white transition-all",
                  selectMode && "cursor-pointer",
                  isSelected
                    ? "border-rose ring-2 ring-rose/30"
                    : "border-cream",
                )}
              >
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
                  className={cn(
                    "object-cover",
                    isSelected && "opacity-75",
                  )}
                />

                {/* Selection checkbox */}
                {selectMode && (
                  <div className="absolute left-2 top-2 flex size-6 items-center justify-center rounded">
                    {isSelected ? (
                      <div className="flex size-5 items-center justify-center rounded bg-rose text-white">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="flex size-5 items-center justify-center rounded border-2 border-white/80 bg-dark/30" />
                    )}
                  </div>
                )}

                {/* Individual delete (only in normal mode) */}
                {!selectMode && (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
