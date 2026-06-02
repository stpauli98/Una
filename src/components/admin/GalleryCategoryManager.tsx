"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Loader2,
} from "lucide-react";
import {
  createGalleryCategory,
  renameGalleryCategory,
  reorderGalleryCategories,
  deleteGalleryCategory,
} from "@/app/admin/(protected)/galerija/actions";

type Cat = { key: string; label: string; count: number };

export function GalleryCategoryManager({ categories }: { categories: Cat[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>(
    categories[0]?.key ?? "",
  );
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState("");

  // Izabrana kategorija (fallback na prvu ako je obrisana ili je nema)
  const selected =
    categories.find((c) => c.key === selectedKey) ?? categories[0] ?? null;
  const selectedIndex = selected
    ? categories.findIndex((c) => c.key === selected.key)
    : -1;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Greška");
    });
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const r = await createGalleryCategory(label);
      if (r.ok) {
        setNewLabel("");
        if (r.data?.key) setSelectedKey(r.data.key);
      } else {
        setError(r.error);
      }
    });
  };

  const saveRename = () => {
    if (!selected) return;
    const label = editLabel.trim();
    if (!label) return;
    run(async () => {
      const r = await renameGalleryCategory(selected.key, label);
      if (r.ok) setEditing(false);
      return r;
    });
  };

  const move = (dir: -1 | 1) => {
    if (!selected) return;
    const target = selectedIndex + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    run(() => reorderGalleryCategories(next.map((c) => c.key)));
  };

  const remove = () => {
    if (!selected || selected.count > 0) return;
    if (!confirm(`Obrisati kategoriju "${selected.label}"?`)) return;
    run(() => deleteGalleryCategory(selected.key));
  };

  const btn =
    "inline-flex items-center gap-1 border border-cream px-2.5 py-2 text-[11px] text-body transition-colors hover:border-rose hover:text-rose disabled:opacity-30 disabled:hover:border-cream disabled:hover:text-body cursor-pointer disabled:cursor-not-allowed";

  return (
    <div className="mb-8 border border-cream bg-white p-5">
      <h2 className="mb-4 font-display text-lg text-dark">Kategorije</h2>

      {error && (
        <div className="mb-3 border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {selected ? (
        <div className="mb-4 space-y-3">
          {/* Izbor kategorije — dropdown (radi na svim ekranima) */}
          <select
            value={selected.key}
            onChange={(e) => {
              setSelectedKey(e.target.value);
              setEditing(false);
            }}
            disabled={pending}
            className="w-full border border-cream bg-white px-3 py-2.5 text-[13px] text-dark focus:border-rose focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>

          {/* Akcije za izabranu kategoriju */}
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRename()}
                maxLength={40}
                autoFocus
                className="min-w-0 flex-1 border border-cream px-3 py-2 text-[13px] text-dark focus:border-rose focus:outline-none"
              />
              <button
                type="button"
                disabled={pending}
                onClick={saveRename}
                className="inline-flex items-center gap-1 bg-rose px-3 py-2 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-40 cursor-pointer"
              >
                <Check size={13} /> Sačuvaj
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="border border-cream px-3 py-2 text-light hover:text-dark cursor-pointer"
                aria-label="Otkaži"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending || selectedIndex <= 0}
                onClick={() => move(-1)}
                className={btn}
              >
                <ArrowUp size={13} /> Gore
              </button>
              <button
                type="button"
                disabled={pending || selectedIndex >= categories.length - 1}
                onClick={() => move(1)}
                className={btn}
              >
                <ArrowDown size={13} /> Dole
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(true);
                  setEditLabel(selected.label);
                }}
                className={btn}
              >
                <Pencil size={13} /> Preimenuj
              </button>
              <button
                type="button"
                disabled={pending || selected.count > 0}
                onClick={remove}
                title={
                  selected.count > 0 ? `Ima ${selected.count} slika` : "Obriši"
                }
                className="inline-flex items-center gap-1 border border-cream px-2.5 py-2 text-[11px] text-red-600 transition-colors hover:border-red-400 disabled:text-light disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 size={13} /> Obriši
              </button>
              <span className="ml-auto text-[11px] text-light">
                {selected.count} slika
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="mb-4 text-[12px] text-light">
          Nema kategorija. Dodajte prvu ispod.
        </p>
      )}

      {/* Dodaj novu kategoriju */}
      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          maxLength={40}
          placeholder="Nova kategorija…"
          className="min-w-0 flex-1 border border-cream px-3 py-2 text-[13px] text-dark focus:border-rose focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || !newLabel.trim()}
          onClick={add}
          className="inline-flex shrink-0 items-center gap-1 bg-rose px-4 py-2 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-40 cursor-pointer"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Dodaj
        </button>
      </div>
    </div>
  );
}
