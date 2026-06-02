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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

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
    run(async () => {
      const r = await createGalleryCategory(label);
      if (r.ok) setNewLabel("");
      return r;
    });
  };

  const saveRename = (key: string) => {
    const label = editLabel.trim();
    if (!label) return;
    run(async () => {
      const r = await renameGalleryCategory(key, label);
      if (r.ok) setEditingKey(null);
      return r;
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...categories];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderGalleryCategories(next.map((c) => c.key)));
  };

  const remove = (c: Cat) => {
    if (c.count > 0) return;
    if (!confirm(`Obrisati kategoriju "${c.label}"?`)) return;
    run(() => deleteGalleryCategory(c.key));
  };

  return (
    <div className="mb-8 border border-cream bg-white p-5">
      <h2 className="mb-4 font-display text-lg text-dark">Kategorije</h2>

      {error && (
        <div className="mb-3 border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      <ul className="mb-4 divide-y divide-cream">
        {categories.map((c, i) => (
          <li key={c.key} className="flex items-center gap-2 py-2.5">
            <div className="flex flex-col">
              <button
                type="button"
                disabled={pending || i === 0}
                onClick={() => move(i, -1)}
                className="text-light hover:text-rose disabled:opacity-30 cursor-pointer"
                aria-label="Pomjeri gore"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                disabled={pending || i === categories.length - 1}
                onClick={() => move(i, 1)}
                className="text-light hover:text-rose disabled:opacity-30 cursor-pointer"
                aria-label="Pomjeri dole"
              >
                <ArrowDown size={13} />
              </button>
            </div>

            {editingKey === c.key ? (
              <>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  maxLength={40}
                  className="flex-1 border border-cream px-2 py-1 text-[13px] text-dark focus:border-rose focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => saveRename(c.key)}
                  className="text-green-600 hover:text-green-700 cursor-pointer"
                  aria-label="Sačuvaj"
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingKey(null)}
                  className="text-light hover:text-dark cursor-pointer"
                  aria-label="Otkaži"
                >
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-[13px] text-dark">
                  {c.label}{" "}
                  <span className="text-[11px] text-light">({c.count})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(c.key);
                    setEditLabel(c.label);
                  }}
                  className="text-light hover:text-rose cursor-pointer"
                  aria-label="Preimenuj"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  disabled={pending || c.count > 0}
                  onClick={() => remove(c)}
                  title={c.count > 0 ? `Ima ${c.count} slika` : "Obriši"}
                  className="text-light hover:text-red-600 disabled:opacity-30 disabled:hover:text-light cursor-pointer"
                  aria-label="Obriši"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          maxLength={40}
          placeholder="Nova kategorija…"
          className="flex-1 border border-cream px-3 py-2 text-[13px] text-dark focus:border-rose focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || !newLabel.trim()}
          onClick={add}
          className="inline-flex items-center gap-1 bg-rose px-4 py-2 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-40 cursor-pointer"
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
