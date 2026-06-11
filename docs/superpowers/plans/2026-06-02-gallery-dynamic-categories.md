# Dinamičke kategorije galerije — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Omogućiti vlasnici (Una) da iz admin panela sama dodaje, preimenuje, mijenja redoslijed i briše kategorije galerije.

**Architecture:** Nova `gallery_categories` tabela kao single-source-of-truth; `gallery_images.category` postaje FK na nju sa `ON DELETE RESTRICT` (DB sprovodi „blokiraj brisanje dok ima slika"). Lista kategorija se čita iz baze (cached) umjesto iz hardkodovanog `GALLERY_CATEGORIES` niza. Admin CRUD preko server akcija; javni filter prikazuje samo ne-prazne kategorije.

**Tech Stack:** Next.js 16 (App Router, RSC, server actions), Supabase (Postgres + RLS), Zod, Vitest, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-02-gallery-dynamic-categories-design.md`

**Preduslov:** Lokalni Docker Supabase pokrenut (`npm run test:setup` ili `npm run supabase:start`). Migracija/DB testiranje ide na LOKALNU bazu, nikad na produkciju (per CLAUDE.md „CRITICAL test safety rules").

---

## File Structure

| Fajl | Odgovornost | Akcija |
|---|---|---|
| `supabase/migrations/20260602000000_gallery_categories.sql` | Tabela, seed, FK, RLS | Create |
| `src/types/database.ts` | TS tipovi baze | Regenerate |
| `src/lib/gallery/categories.ts` | `slugifyCategory` helper + tip | Modify |
| `tests/unit/gallery-categories.test.ts` | Unit test za slug | Create |
| `src/lib/cache/admin-cache-tags.ts` | Cache tag `galleryCategories` | Modify |
| `src/lib/cache/cached-queries.ts` | `getCachedGalleryCategories` | Modify |
| `src/app/admin/(protected)/galerija/actions.ts` | 4 CRUD akcije + `deriveAltText` refaktor | Modify |
| `src/components/admin/GalleryCategoryManager.tsx` | Admin UI za kategorije | Create |
| `src/app/admin/(protected)/galerija/page.tsx` | Fetch kategorija + broj slika, render managera | Modify |
| `src/components/admin/GalleryManager.tsx` | Dropdown iz prop-a umjesto static | Modify |
| `src/app/galerija/page.tsx` | Fetch kategorija, proslijedi GalleryGrid-u | Modify |
| `src/components/public/GalleryGrid.tsx` | Filter iz prop-a, samo ne-prazne | Modify |

---

## Task 1: `slugifyCategory` helper (TDD)

**Files:**
- Modify: `src/lib/gallery/categories.ts`
- Test: `tests/unit/gallery-categories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gallery-categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugifyCategory } from "@/lib/gallery/categories";

describe("slugifyCategory", () => {
  it("lowercases ASCII", () => {
    expect(slugifyCategory("Pedikir")).toBe("pedikir");
  });
  it("strips Serbian diacritics", () => {
    expect(slugifyCategory("Šminkanje")).toBe("sminkanje");
    expect(slugifyCategory("Đođ")).toBe("djodj");
    expect(slugifyCategory("Čačać")).toBe("cacac");
    expect(slugifyCategory("Žaba")).toBe("zaba");
  });
  it("replaces spaces and non-alphanumerics with hyphen", () => {
    expect(slugifyCategory("Spa pedikir")).toBe("spa-pedikir");
    expect(slugifyCategory("Nokti & gel")).toBe("nokti-gel");
  });
  it("trims leading/trailing hyphens and collapses repeats", () => {
    expect(slugifyCategory("  Mladenke!  ")).toBe("mladenke");
    expect(slugifyCategory("a---b")).toBe("a-b");
  });
  it("returns empty string for input with no usable chars", () => {
    expect(slugifyCategory("!!!")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/gallery-categories.test.ts`
Expected: FAIL — `slugifyCategory` is not exported.

- [ ] **Step 3: Add the helper**

Append to `src/lib/gallery/categories.ts` (keep existing exports for now — they are removed in Task 6):

```ts
/**
 * Pretvara prikazni label u stabilan lowercase-ASCII slug za `key`.
 * Skida srpsku dijakritiku, zamjenjuje ne-alfanumerike crticom.
 * Vraća "" ako nema upotrebljivih znakova (caller mora rukovati tim slučajem).
 */
export function slugifyCategory(label: string): string {
  const map: Record<string, string> = {
    š: "s", đ: "dj", č: "c", ć: "c", ž: "z",
    Š: "s", Đ: "dj", Č: "c", Ć: "c", Ž: "z",
  };
  return label
    .trim()
    .replace(/[šđčćžŠĐČĆŽ]/g, (ch) => map[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/gallery-categories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery/categories.ts tests/unit/gallery-categories.test.ts
git commit -m "feat(gallery): add slugifyCategory helper with unit tests"
```

---

## Task 2: Migracija — `gallery_categories` tabela + FK + RLS

**Files:**
- Create: `supabase/migrations/20260602000000_gallery_categories.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602000000_gallery_categories.sql`:

```sql
-- Dinamičke kategorije galerije (admin-managed).
-- gallery_images.category postaje FK; ON DELETE RESTRICT blokira brisanje
-- kategorije koja još ima slike.

create table if not exists public.gallery_categories (
  key text primary key,
  label text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Jedinstven label (case-insensitive) — sprečava duplikate naziva.
create unique index if not exists gallery_categories_label_lower_key
  on public.gallery_categories (lower(label));

-- Seed postojećih 5 (MORA prije FK-a inače postojeće slike krše constraint).
insert into public.gallery_categories (key, label, order_index) values
  ('sminkanje', 'Šminkanje', 1),
  ('svadbeno',  'Svadbeno',  2),
  ('pedikir',   'Pedikir',   3),
  ('trepavice', 'Trepavice', 4),
  ('obuka',     'Obuka',     5)
on conflict (key) do nothing;

-- Zamijeni CHECK constraint FK-om.
alter table public.gallery_images
  drop constraint if exists gallery_images_category_check;

alter table public.gallery_images
  add constraint gallery_images_category_fkey
  foreign key (category) references public.gallery_categories (key)
  on delete restrict on update cascade;

-- RLS: javno čitanje (za filter), admin upis preko is_admin().
alter table public.gallery_categories enable row level security;

create policy "gallery_categories public read"
  on public.gallery_categories for select
  using (true);

create policy "gallery_categories admin write"
  on public.gallery_categories for all
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 2: Apply migration to LOCAL Docker Supabase**

Run: `npm run supabase:start` (ako nije pokrenut), zatim `supabase db reset` (re-runuje sve migracije na lokalnoj bazi).
Expected: migracija prolazi bez greške; izlaz spominje `20260602000000_gallery_categories`.

- [ ] **Step 3: Verify schema in local DB**

Run:
```bash
supabase db diff --schema public 2>/dev/null | head -5 || true
psql "$(supabase status -o env 2>/dev/null | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\d public.gallery_categories" -c "select count(*) from public.gallery_categories;"
```
Expected: tabela ima kolone key/label/order_index/created_at; count = 5.

- [ ] **Step 4: Verify FK blocks delete of non-empty category**

Run (na lokalnoj bazi):
```bash
DBURL="$(supabase status -o env | grep '^DB_URL' | cut -d= -f2- | tr -d '\"')"
psql "$DBURL" -c "insert into gallery_images (storage_path, category, alt_text, order_index) values ('test/x.webp','sminkanje','t',999);"
psql "$DBURL" -c "delete from gallery_categories where key='sminkanje';" 2>&1 | grep -i "violates foreign key" && echo "BLOK OK (očekivano)"
psql "$DBURL" -c "delete from gallery_images where storage_path='test/x.webp';"
psql "$DBURL" -c "insert into gallery_categories (key,label,order_index) values ('prazna','Prazna',99); delete from gallery_categories where key='prazna';" && echo "PRAZNA OBRISANA OK"
```
Expected: brisanje ne-prazne → „violates foreign key" (blok radi); prazna se briše bez greške.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260602000000_gallery_categories.sql
git commit -m "feat(gallery): add gallery_categories table with FK + RLS migration"
```

---

## Task 3: Regenerate database types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerate types from local DB**

Run: `supabase gen types typescript --local > src/types/database.ts`
Expected: fajl sada sadrži `gallery_categories` u `public.Tables`.

- [ ] **Step 2: Verify**

Run: `grep -n "gallery_categories" src/types/database.ts | head`
Expected: bar jedan pogodak (Row/Insert/Update tipovi).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (postojeći kod još koristi `GALLERY_CATEGORIES`, to je i dalje validno).

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(gallery): regenerate database types for gallery_categories"
```

---

## Task 4: Cache tag + cached read

**Files:**
- Modify: `src/lib/cache/admin-cache-tags.ts`
- Modify: `src/lib/cache/cached-queries.ts`

- [ ] **Step 1: Add cache tag**

In `src/lib/cache/admin-cache-tags.ts`, add the `galleryCategories` entry to the object:

```ts
export const ADMIN_CACHE_TAGS = {
  services: "admin:services",
  settings: "admin:settings",
  workingHours: "admin:working_hours",
  blockedDates: "admin:blocked_dates",
  timeBlocks: "admin:time_blocks",
  gallery: "admin:gallery",
  galleryCategories: "admin:gallery_categories",
} as const;
```

- [ ] **Step 2: Add cached read**

In `src/lib/cache/cached-queries.ts`, append after `getCachedGalleryImages`:

```ts
export const getCachedGalleryCategories = unstable_cache(
  async () => {
    const sb = createAdminClient();
    const { data } = await sb
      .from("gallery_categories")
      .select("key, label, order_index")
      .order("order_index");
    return data ?? [];
  },
  ["admin-gallery-categories-all"],
  { tags: [ADMIN_CACHE_TAGS.galleryCategories] },
);
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cache/admin-cache-tags.ts src/lib/cache/cached-queries.ts
git commit -m "feat(gallery): add galleryCategories cache tag + cached read"
```

---

## Task 5: Server akcije (CRUD)

**Files:**
- Modify: `src/app/admin/(protected)/galerija/actions.ts`

Trenutni fajl već importuje: `requireAdmin`, `revalidatePath`, `updateTag`, `ADMIN_CACHE_TAGS`, `createAdminClient`, `isValidGalleryCategory`, `GalleryCategory`. Dodaje se `slugifyCategory` i `getCachedGalleryCategories` ako zatreba; akcije koriste `createAdminClient` direktno.

- [ ] **Step 1: Add imports**

At top of `src/app/admin/(protected)/galerija/actions.ts`, update the categories import line:

```ts
import {
  isValidGalleryCategory,
  slugifyCategory,
  type GalleryCategory,
} from "@/lib/gallery/categories";
```

- [ ] **Step 2: Add the 4 CRUD actions**

Append at the end of `src/app/admin/(protected)/galerija/actions.ts`:

```ts
function revalidateCategories() {
  updateTag(ADMIN_CACHE_TAGS.galleryCategories);
  revalidatePath("/admin/galerija");
  revalidatePath("/galerija");
}

export async function createGalleryCategory(
  label: string,
): Promise<ActionResult<{ key: string }>> {
  try {
    await requireAdmin();
    const clean = label.trim();
    if (clean.length < 1 || clean.length > 40) {
      return { ok: false, error: "Naziv mora imati 1–40 znakova" };
    }
    let key = slugifyCategory(clean);
    if (!key) return { ok: false, error: "Naziv mora sadržati slovo ili broj" };

    const admin = createAdminClient();

    // Provjeri jedinstvenost labela (case-insensitive)
    const { data: existing } = await admin
      .from("gallery_categories")
      .select("key, label");
    const rows = existing ?? [];
    if (rows.some((r) => r.label.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: "Kategorija s tim nazivom već postoji" };
    }
    // Slug kolizija → sufiks broj
    const keys = new Set(rows.map((r) => r.key));
    if (keys.has(key)) {
      let n = 2;
      while (keys.has(`${key}-${n}`)) n++;
      key = `${key}-${n}`;
    }
    const maxOrder = rows.reduce(
      (m, r) => Math.max(m, (r as { order_index?: number }).order_index ?? 0),
      0,
    );

    const { error } = await admin
      .from("gallery_categories")
      .insert({ key, label: clean, order_index: maxOrder + 1 });
    if (error) return { ok: false, error: error.message };

    revalidateCategories();
    return { ok: true, data: { key } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function renameGalleryCategory(
  key: string,
  label: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const clean = label.trim();
    if (clean.length < 1 || clean.length > 40) {
      return { ok: false, error: "Naziv mora imati 1–40 znakova" };
    }
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("gallery_categories")
      .select("key, label");
    const rows = existing ?? [];
    if (!rows.some((r) => r.key === key)) {
      return { ok: false, error: "Kategorija ne postoji" };
    }
    if (
      rows.some(
        (r) => r.key !== key && r.label.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return { ok: false, error: "Kategorija s tim nazivom već postoji" };
    }

    const { error } = await admin
      .from("gallery_categories")
      .update({ label: clean })
      .eq("key", key);
    if (error) return { ok: false, error: error.message };

    revalidateCategories();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reorderGalleryCategories(
  orderedKeys: string[],
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!Array.isArray(orderedKeys) || orderedKeys.length === 0) {
      return { ok: false, error: "Prazan redoslijed" };
    }
    const admin = createAdminClient();
    // Sekvencijalni update (mali broj kategorija — desetak max)
    for (let i = 0; i < orderedKeys.length; i++) {
      const { error } = await admin
        .from("gallery_categories")
        .update({ order_index: i + 1 })
        .eq("key", orderedKeys[i]);
      if (error) return { ok: false, error: error.message };
    }
    revalidateCategories();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteGalleryCategory(
  key: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .from("gallery_categories")
      .delete()
      .eq("key", key);
    if (error) {
      // 23503 = foreign_key_violation → kategorija ima slike
      if ((error as { code?: string }).code === "23503") {
        return {
          ok: false,
          error:
            "Kategorija ima slike — premjesti ili obriši ih prije brisanja kategorije.",
        };
      }
      return { ok: false, error: error.message };
    }
    revalidateCategories();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 3: Refactor `deriveAltText` to use dynamic label fallback**

In `src/app/admin/(protected)/galerija/actions.ts`, the existing `GALLERY_ALT` map + `deriveAltText` cover only the 5 seed categories. Replace `deriveAltText`'s fallback to accept a label. Change its signature and the call site.

Replace the `deriveAltText` function body's fallback line:

```ts
function deriveAltText(
  fileName: string,
  category: string,
  label?: string,
): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  if (!base || base.toLowerCase() === "blob") {
    return (
      GALLERY_ALT[category] ??
      `UP Makeup — ${label ?? category} Gradiška`
    );
  }
  return base;
}
```

And update the call site inside `uploadSingleGalleryImage` to pass the label. Just before the insert, fetch the label:

```ts
    const { data: catRow } = await admin
      .from("gallery_categories")
      .select("label")
      .eq("key", category)
      .maybeSingle();
```

Then change the insert's `alt_text` line to:

```ts
        alt_text: deriveAltText(file.name, category, catRow?.label),
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(protected)/galerija/actions.ts"
git commit -m "feat(gallery): add category CRUD server actions"
```

---

## Task 6: Refaktor `categories.ts` — ukloni statičku listu

**Files:**
- Modify: `src/lib/gallery/categories.ts`

Sada kada se kategorije čitaju iz baze, statički `GALLERY_CATEGORIES`/`GALLERY_CATEGORY_KEYS` se uklanjaju. `isValidGalleryCategory` postaje sinhroni guard nad **prosljeđenom** listom (consumeri proslijede ključeve iz cached read-a).

- [ ] **Step 1: Rewrite the file**

Replace entire `src/lib/gallery/categories.ts` with:

```ts
/**
 * Gallery kategorije su sada DINAMIČKE (DB tabela `gallery_categories`).
 * Lista se čita preko `getCachedGalleryCategories()` (cached-queries.ts).
 * Ovaj modul drži samo: tip, slug helper, i validaciju nad prosljeđenom listom.
 */

export type GalleryCategoryDef = {
  readonly key: string;
  readonly label: string;
};

/** Kategorija je sada proizvoljan string key (validira se protiv DB liste). */
export type GalleryCategory = string;

/**
 * Pretvara prikazni label u stabilan lowercase-ASCII slug za `key`.
 * Skida srpsku dijakritiku, zamjenjuje ne-alfanumerike crticom.
 * Vraća "" ako nema upotrebljivih znakova (caller mora rukovati tim slučajem).
 */
export function slugifyCategory(label: string): string {
  const map: Record<string, string> = {
    š: "s", đ: "dj", č: "c", ć: "c", ž: "z",
    Š: "s", Đ: "dj", Č: "c", Ć: "c", Ž: "z",
  };
  return label
    .trim()
    .replace(/[šđčćžŠĐČĆŽ]/g, (ch) => map[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validira da je `value` jedan od dozvoljenih key-jeva iz prosljeđene liste. */
export function isValidGalleryCategory(
  value: string,
  validKeys: readonly string[],
): boolean {
  return validKeys.includes(value);
}
```

- [ ] **Step 2: Update `uploadSingleGalleryImage` to pass valid keys**

In `src/app/admin/(protected)/galerija/actions.ts`, the call `isValidGalleryCategory(categoryRaw)` now needs the valid-keys list. Replace the validation block at the start of `uploadSingleGalleryImage`:

```ts
    const categoryRaw = String(formData.get("category") ?? "");
    const admin = createAdminClient();
    const { data: cats } = await admin
      .from("gallery_categories")
      .select("key, label");
    const validKeys = (cats ?? []).map((c) => c.key);
    if (!isValidGalleryCategory(categoryRaw, validKeys)) {
      return { ok: false, error: "Neispravna kategorija" };
    }
    const category: GalleryCategory = categoryRaw;
    const catLabel = (cats ?? []).find((c) => c.key === categoryRaw)?.label;
```

Note: this moves `createAdminClient()` earlier. Remove the later duplicate `const admin = createAdminClient();` inside the same function (there is one before the max-order query) — there must be exactly one `admin` declaration. Also remove the now-redundant separate `catRow` fetch from Task 5 Step 3 and use `catLabel` instead:

```ts
        alt_text: deriveAltText(file.name, category, catLabel),
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `GalleryManager.tsx` and `GalleryGrid.tsx` still import `GALLERY_CATEGORIES`. That is fixed in Tasks 7–8. Confirm the ONLY errors are those two imports.

Run: `npm run typecheck 2>&1 | grep -E "GALLERY_CATEGORIES|GalleryManager|GalleryGrid"`
Expected: errors reference only those two component files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/gallery/categories.ts "src/app/admin/(protected)/galerija/actions.ts"
git commit -m "refactor(gallery): make categories dynamic, remove static list"
```

---

## Task 7: `GalleryCategoryManager` komponenta + admin page wiring

**Files:**
- Create: `src/components/admin/GalleryCategoryManager.tsx`
- Modify: `src/app/admin/(protected)/galerija/page.tsx`
- Modify: `src/components/admin/GalleryManager.tsx`

- [ ] **Step 1: Create the manager component**

Create `src/components/admin/GalleryCategoryManager.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Check, X, Loader2 } from "lucide-react";
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
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Dodaj
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into admin page**

Replace `src/app/admin/(protected)/galerija/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { GalleryCategoryManager } from "@/components/admin/GalleryCategoryManager";
import {
  getCachedGalleryImages,
  getCachedGalleryCategories,
} from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Galerija — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminGalerijaPage() {
  const [images, categories] = await Promise.all([
    getCachedGalleryImages(),
    getCachedGalleryCategories(),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const mapped = images.map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/gallery/${img.storage_path}`,
    category: img.category,
    alt: img.alt_text ?? `UP Makeup — ${img.category}`,
  }));

  const countByKey = images.reduce<Record<string, number>>((acc, img) => {
    acc[img.category] = (acc[img.category] ?? 0) + 1;
    return acc;
  }, {});

  const cats = categories.map((c) => ({
    key: c.key,
    label: c.label,
    count: countByKey[c.key] ?? 0,
  }));

  return (
    <div>
      <PageHeader title="Galerija" subtitle="Upload i organizacija slika" />
      <div className="p-5 md:p-8">
        <GalleryCategoryManager categories={cats} />
        <GalleryManager items={mapped} categories={cats} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `GalleryManager` to accept categories prop**

In `src/components/admin/GalleryManager.tsx`:

(a) Remove the static import line `import { GALLERY_CATEGORIES } from "@/lib/gallery/categories";` and the line `const CATEGORIES = GALLERY_CATEGORIES;`.

(b) Update the component signature and derive CATEGORIES from props:

```tsx
type GalleryCat = { key: string; label: string; count: number };

export function GalleryManager({
  items,
  categories,
}: {
  items: GalleryItem[];
  categories: GalleryCat[];
}) {
  const CATEGORIES = categories;
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0]?.key ?? "",
  );
```

(c) The existing JSX references `CATEGORIES.map`, `CATEGORIES.find((c) => c.key === ...)`, and `cat.key`/`cat.label` — these all still work because `categories` has `{ key, label }`. The category-button count `items.filter((i) => i.category === cat.key).length` still works. No further JSX change needed.

(d) Guard empty categories: if `categories.length === 0`, the upload section should still render but with no active category. Add, right after the early hooks, a friendly note. Replace the opening of the returned `<div>` (the one at the `<div className="mb-5 flex gap-1.5 overflow-x-auto">`) — prepend:

```tsx
      {categories.length === 0 && (
        <div className="mb-5 border border-cream bg-warm p-4 text-center text-[12px] text-light">
          Nema kategorija. Dodajte prvu u sekciji „Kategorije" iznad.
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck 2>&1 | grep -E "GalleryManager|GalleryGrid|galerija/page"`
Expected: only `GalleryGrid.tsx` errors remain (fixed in Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/GalleryCategoryManager.tsx "src/app/admin/(protected)/galerija/page.tsx" src/components/admin/GalleryManager.tsx
git commit -m "feat(gallery): admin category manager UI + dynamic upload dropdown"
```

---

## Task 8: Public filter dinamičan + samo ne-prazne

**Files:**
- Modify: `src/app/galerija/page.tsx`
- Modify: `src/components/public/GalleryGrid.tsx`

- [ ] **Step 1: Pass categories from the public page**

In `src/app/galerija/page.tsx`, fetch categories and pass them. Add after the images query:

```tsx
  const { data: categories } = await supabase
    .from("gallery_categories")
    .select("key, label, order_index")
    .order("order_index");
```

And change the `<GalleryGrid images={mapped} />` to:

```tsx
      <GalleryGrid
        images={mapped}
        categories={(categories ?? []).map((c) => ({ key: c.key, label: c.label }))}
      />
```

- [ ] **Step 2: Update `GalleryGrid` to derive filters from props (only non-empty)**

In `src/components/public/GalleryGrid.tsx`:

(a) Remove the static import `import { GALLERY_CATEGORIES, type GalleryCategoryDef } from "@/lib/gallery/categories";` and the static `FILTERS` const (lines 17–20).

(b) Add a local type and update Props:

```tsx
type GalleryCategoryDef = { key: string; label: string };

type Props = {
  images: GalleryImage[];
  categories: GalleryCategoryDef[];
};

export function GalleryGrid({ images, categories }: Props) {
  // Samo kategorije koje stvarno imaju ≥1 sliku (bez praznih dugmadi).
  const presentKeys = new Set(images.map((img) => img.category));
  const FILTERS: readonly GalleryCategoryDef[] = [
    { key: "sve", label: "Sve" },
    ...categories.filter((c) => presentKeys.has(c.key)),
  ];
```

(The rest of the component — `activeFilter`, lightbox, the `FILTERS.map` render — is unchanged and references `FILTERS` which is now computed inside the component.)

- [ ] **Step 3: Verify no remaining static-list imports**

Run: `grep -rn "GALLERY_CATEGORIES\|GALLERY_CATEGORY_KEYS" src/`
Expected: no matches.

- [ ] **Step 4: Full typecheck + lint + build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint 2>&1 | grep -E "galerija|GalleryGrid|GalleryManager|GalleryCategoryManager|categories.ts"`
Expected: no errors in our files (pre-existing repo lint errors in Nav.tsx/tests are unrelated).

Run: `npm run build`
Expected: PASS (production webpack build).

- [ ] **Step 5: Commit**

```bash
git add src/app/galerija/page.tsx src/components/public/GalleryGrid.tsx
git commit -m "feat(gallery): public filter reads dynamic categories, hides empty ones"
```

---

## Task 9: Manual verification on local Docker

**Files:** none (verification only)

- [ ] **Step 1: Run dev server against local Supabase**

Ensure `.env.local` points to LOCAL Docker Supabase (per CLAUDE.md testing flow — never run this against prod). Run: `npm run dev`.

- [ ] **Step 2: Verify admin flow**

In browser at `/admin/galerija` (logged in as local admin):
- „Kategorije" panel lists 5 seed categories with counts.
- Add „Mladenke" → appears; upload dropdown in GalleryManager shows it.
- Rename it → label changes, key stays.
- Reorder with arrows → order persists on refresh.
- Try delete a category with images → blocked with friendly message.
- Delete the empty „Mladenke" → removed.

- [ ] **Step 3: Verify public flow**

At `/galerija`: filter buttons show only categories that have images; „Sve" first. Add an image to a new category → that filter appears after revalidation.

- [ ] **Step 4: Final commit (if any verification tweaks)**

```bash
git add -A
git commit -m "test(gallery): verify dynamic categories flow on local Docker" || echo "nothing to commit"
```

---

## Production rollout (poslije merge-a)

Migracija `20260602000000_gallery_categories.sql` mora se primijeniti na produkciju. Pošto je `supabase db push` na produkciju van CI-ja, primijeniti svjesno (uz potvrdu vlasnika): `supabase db push` na linkovani projekat, ILI ekvivalentan SQL preko Management API-ja. Redoslijed (seed prije FK) je već u migraciji. Postojećih 60 slika zadovoljava FK (kategorije su seed-ovane). Vercel deploy koda ide kroz PR → main (git integracija).

**⚠️ Zavisnost `is_admin()`:** RLS policy `gallery_categories admin write` koristi `public.is_admin()`. Ta funkcija je definisana u `20260527000000_security_hardening.sql`, koja je na grani `fix/security-hardening` i **nije mergovana u `main` ni primijenjena na produkciju** (vidi migration drift). Prije primjene OVE migracije na produkciju, provjeriti postoji li `public.is_admin()` na produkciji (`select to_regprocedure('public.is_admin()')`). Ako NE postoji: ili prvo deployovati security-hardening, ili privremeno zamijeniti policy direktnom provjerom `auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com'`. Lokalno (`supabase db reset`) funkcija postoji jer se puštaju sve migracije, pa Tasks 1–9 rade bez izmjene.

---

## Self-Review (autor plana)

- **Spec coverage:** tabela+FK (T2), slug (T1), 4 akcije (T5), admin UI (T7), javni filter samo-ne-prazne (T8), keširanje (T4), refaktor 3 potrošača (T5/T6/T7/T8), edge (duplikat/prazan/kolizija/FK-blok u T5; alt fallback u T5/T6). Pokriveno.
- **Placeholderi:** nema TODO/TBD; sav kod dat.
- **Tip-konzistentnost:** `getCachedGalleryCategories` vraća `{key,label,order_index}`; admin page mapira u `{key,label,count}`; `GalleryManager`/`GalleryCategoryManager`/`GalleryGrid` koriste te oblike dosljedno. `deriveAltText(fileName, category, label?)` poziva se sa `catLabel` (T6 finalno). `isValidGalleryCategory(value, validKeys)` poziva se sa `validKeys` u T6.
