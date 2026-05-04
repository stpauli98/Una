"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Info, Image as ImageIcon, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { createService, updateService } from "@/app/admin/(protected)/usluge/actions";
import type { Database } from "@/types/database";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  service?: Service | null;
  /** Public URL postojeće slike (parent gradi). */
  imageUrl?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ServiceForm({ service, imageUrl, onClose, onSaved }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Controlled state — kontroliše vidljivost note polja.
  // price_note → vidljiv samo kad variable_price je true
  // duration_note → vidljiv samo kad duration_min je "" (bez vremenskog trajanja)
  const [variablePrice, setVariablePrice] = useState<boolean>(
    service?.variable_price ?? false,
  );
  const [durationMin, setDurationMin] = useState<string>(
    service?.duration_min != null ? String(service.duration_min) : "",
  );

  const showPriceNote = variablePrice;
  const showDurationNote = durationMin === "";

  type ImageState =
    | { mode: "none" }
    | { mode: "existing" }
    | { mode: "replace"; file: File; previewUrl: string }
    | { mode: "remove" };

  const [imageState, setImageState] = useState<ImageState>(() =>
    service?.image_path ? { mode: "existing" } : { mode: "none" },
  );
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imageState.mode === "replace") {
        URL.revokeObjectURL(imageState.previewUrl);
      }
    };
  }, [imageState]);

  const handleFilePick = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Format slike mora biti JPG, PNG ili WebP");
      return;
    }
    setImageError(null);
    setError(null);
    setCompressing(true);
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      if (imageState.mode === "replace") {
        URL.revokeObjectURL(imageState.previewUrl);
      }
      setImageState({
        mode: "replace",
        file: compressed,
        previewUrl: URL.createObjectURL(compressed),
      });
    } catch {
      if (imageState.mode === "replace") {
        URL.revokeObjectURL(imageState.previewUrl);
      }
      setImageState({
        mode: "replace",
        file,
        previewUrl: URL.createObjectURL(file),
      });
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCancelReplace = () => {
    if (imageState.mode === "replace") {
      URL.revokeObjectURL(imageState.previewUrl);
    }
    setImageState(service?.image_path ? { mode: "existing" } : { mode: "none" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = () => setImageState({ mode: "remove" });

  const handleUndoRemove = () => setImageState({ mode: "existing" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-cream bg-white">
        <div className="border-b border-cream px-5 py-4">
          <h2 className="font-display text-xl text-dark">
            {service ? "Izmijeni uslugu" : "Nova usluga"}
          </h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            // Smart cleanup: ako note polje nije relevantno (sakrivene
            // konfiguracije), forsiraj prazan string da DB ne ostane sa
            // stale tekstom iz prethodnog editovanja.
            if (!showPriceNote) {
              fd.set("price_note", "");
            }
            if (!showDurationNote) {
              fd.set("duration_note", "");
            }
            // Image polja u FormData
            if (imageState.mode === "replace") {
              fd.set("image", imageState.file);
            }
            if (imageState.mode === "remove") {
              fd.set("removeImage", "true");
            }
            startTransition(async () => {
              const result = service
                ? await updateService(service.id, fd)
                : await createService(fd);
              if (result.ok) {
                onSaved();
                onClose();
              } else {
                setError(result.error);
              }
            });
          }}
          className="space-y-4 px-5 py-5"
        >
          <Field label="Naziv">
            <input
              name="name"
              required
              defaultValue={service?.name ?? ""}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            />
          </Field>

          <Field label="Opis">
            <textarea
              name="description"
              rows={2}
              defaultValue={service?.description ?? ""}
              className="w-full resize-none border border-cream bg-marble px-3 py-2 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            />
          </Field>

          <Field label="Slika (opciono)">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFilePick(f);
              }}
            />

            {imageState.mode === "none" && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-cream bg-marble px-4 py-6 text-[12px] text-light hover:border-rose hover:text-rose disabled:opacity-60"
              >
                <ImageIcon size={14} strokeWidth={1.5} />
                {compressing ? "Kompresija..." : "Dodaj sliku · JPG/PNG/WebP · max 5 MB"}
              </button>
            )}

            {imageState.mode === "existing" && imageUrl && (
              <div className="flex items-center gap-3 border border-cream bg-marble p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={service?.name ?? ""}
                  className="size-16 object-cover"
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  <p className="text-[11px] text-dark">Trenutna slika</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={compressing}
                      className="text-[11px] text-rose underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      Zamijeni
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={compressing}
                      className="text-[11px] text-red-600 underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      Ukloni
                    </button>
                  </div>
                </div>
              </div>
            )}

            {imageState.mode === "replace" && (
              <div className="flex items-center gap-3 border border-cream bg-marble p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageState.previewUrl}
                  alt="Preview"
                  className="size-16 object-cover"
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  <p className="text-[11px] text-dark">
                    Nova slika · {(imageState.file.size / 1024).toFixed(0)} KB
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelReplace}
                    className="self-start text-[11px] text-rose underline-offset-2 hover:underline"
                  >
                    Otkaži zamjenu
                  </button>
                </div>
              </div>
            )}

            {imageState.mode === "remove" && (
              <div className="flex items-center justify-between border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-2 text-[11px] text-red-700">
                  <X size={12} strokeWidth={2} />
                  Slika će biti uklonjena pri save-u
                </p>
                <button
                  type="button"
                  onClick={handleUndoRemove}
                  className="text-[11px] text-rose underline-offset-2 hover:underline"
                >
                  Vrati
                </button>
              </div>
            )}

            {imageError && (
              <p className="mt-2 text-[11px] text-red-600">{imageError}</p>
            )}
          </Field>

          <Field label="Cijena (KM)">
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={service?.price ?? ""}
              placeholder="npr. 70 — opciono ako koristiš napomenu"
              className="w-full border border-cream bg-marble px-3 py-2 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            />
            <div className="mt-1.5 flex gap-2 text-[11px] leading-relaxed text-light">
              <Info size={12} className="mt-0.5 shrink-0" strokeWidth={1.5} />
              <span>
                Možeš ostaviti prazno ako će cijena biti samo tekst (npr.{" "}
                <em>&quot;Od 50 KM&quot;</em>). U tom slučaju čekiraj
                &quot;Varijabilna cijena&quot; ispod i upiši napomenu. Mora biti
                popunjeno barem jedno (broj ili tekst).
              </span>
            </div>
          </Field>

          <Field label="Trajanje">
            <select
              name="duration_min"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            >
              <option value="">— (bez vremenskog trajanja)</option>
              <option value="30">30 min</option>
              <option value="60">1h</option>
              <option value="90">1h 30min</option>
              <option value="120">2h</option>
              <option value="150">2h 30min</option>
              <option value="180">3h</option>
              <option value="210">3h 30min</option>
              <option value="240">4h</option>
            </select>
          </Field>

          {showDurationNote && (
            <ConditionalField
              label="Napomena trajanja"
              hint='Pošto je trajanje "—" (bez minuta), ovdje napišite čime ga zamjenjujete. Primjer: "5 dana", "po dogovoru", "1 sedmica". Ovaj tekst zamjenjuje brojku trajanja na javnom sajtu.'
              name="duration_note"
              placeholder="npr. 5 dana"
              defaultValue={service?.duration_note ?? ""}
            />
          )}

          <Field label="Kategorija">
            <select
              name="category"
              required
              defaultValue={service?.category ?? "sminkanje"}
              className="w-full border border-cream bg-marble px-3 py-2 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            >
              <option value="sminkanje">Šminkanje</option>
              <option value="pedikir">Pedikir</option>
              <option value="trepavice">Trepavice</option>
              <option value="obuka">Obuka</option>
            </select>
          </Field>

          <div className="space-y-2 rounded bg-stone-50 p-3">
            <Checkbox
              name="bookable"
              label="Dostupna za online zakazivanje"
              defaultChecked={service?.bookable ?? true}
            />
            <Checkbox
              name="variable_price"
              label="Varijabilna cijena (npr. terensko, po dogovoru)"
              checked={variablePrice}
              onChange={(checked) => setVariablePrice(checked)}
            />
            <Checkbox
              name="active"
              label="Aktivna (prikazuje se na sajtu)"
              defaultChecked={service?.active ?? true}
            />
          </div>

          {showPriceNote && (
            <ConditionalField
              label="Napomena cijene"
              hint='Pošto je cijena varijabilna, ovdje napišite kako se prikazuje klijentu. Primjer: "od 150 KM", "po dogovoru", "od 50 KM/sat". Ovaj tekst zamjenjuje broj iz polja "Cijena (KM)" na javnom sajtu.'
              name="price_note"
              placeholder="npr. od 150 KM"
              defaultValue={service?.price_note ?? ""}
            />
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 border border-cream bg-white py-2.5 text-[11px] uppercase tracking-wider text-body hover:border-rose hover:text-rose cursor-pointer"
            >
              Otkaži
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Čuvam..." : "Sačuvaj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wider text-dark">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Polje koje se prikazuje samo pod određenim uslovom (npr. varijabilna
 * cijena ili nemerljivo trajanje). Ima mali "info" baner koji objašnjava
 * šta polje radi i daje konkretne primjere.
 */
function ConditionalField({
  label,
  hint,
  name,
  placeholder,
  defaultValue,
}: {
  label: string;
  hint: string;
  name: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <div className="rounded border border-rose/30 bg-rose/[0.04] p-3">
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-dark">
        {label}
      </label>
      <div className="mb-2 flex gap-2 text-[11px] leading-relaxed text-body">
        <Info size={12} className="mt-0.5 shrink-0 text-rose" strokeWidth={2} />
        <span>{hint}</span>
      </div>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full border border-cream bg-white px-3 py-2 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
      />
    </div>
  );
}

type CheckboxProps = {
  name: string;
  label: string;
} & (
  | { defaultChecked: boolean; checked?: never; onChange?: never }
  | {
      defaultChecked?: never;
      checked: boolean;
      onChange: (checked: boolean) => void;
    }
);

function Checkbox(props: CheckboxProps) {
  const { name, label } = props;
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-body">
      {"checked" in props && props.checked !== undefined ? (
        <input
          type="checkbox"
          name={name}
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          className="accent-rose"
        />
      ) : (
        <input
          type="checkbox"
          name={name}
          defaultChecked={props.defaultChecked}
          className="accent-rose"
        />
      )}
      {label}
    </label>
  );
}
