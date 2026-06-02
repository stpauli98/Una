# Dinamičke kategorije galerije

**Datum:** 2026-06-02
**Status:** Dizajn odobren, čeka plan implementacije

## Problem

Kategorije galerije su hardkodovane na dva mjesta:

1. **Kod** — `src/lib/gallery/categories.ts` (`GALLERY_CATEGORIES`: `sminkanje, svadbeno, pedikir, trepavice, obuka`), koju koriste admin upload UI, javni filter i server validacija.
2. **Baza** — CHECK constraint `gallery_images_category_check` dozvoljava samo tih 5 vrijednosti.

Nema `gallery_categories` tabele. Dodavanje nove kategorije zahtijeva programera (izmjena koda + migracija baze). Vlasnica (Una) to ne može iz admin panela.

## Cilj

Una iz admin panela samostalno **dodaje, preimenuje, mijenja redoslijed i briše** kategorije galerije — bez programera.

### Non-goals (van opsega)

- Kategorije **usluga** (`services.category`) ostaju nepromijenjene — ovo se tiče isključivo galerije.
- Migracija/preuređivanje postojećih 60 slika (ostaju u svojim kategorijama).
- Promjena `key`-a postojećih kategorija (stabilni su, koriste se u storage putanjama).

## Odabrani pristup: `gallery_categories` tabela + FK

Nova tabela kao single-source-of-truth, sa FK iz `gallery_images`. **`ON DELETE RESTRICT` na DB nivou automatski sprovodi pravilo „blokiraj brisanje dok kategorija ima slike"** — bez dodatne app logike.

Razmatrane alternative (odbačene): kategorije kao JSON u `settings` (nema referencijalnog integriteta, nezgrapan CRUD/redoslijed); lookup tabela bez FK-a (gubi DB-garanciju integriteta).

## Model podataka

### Nova tabela `gallery_categories`

| Kolona | Tip | Napomena |
|---|---|---|
| `key` | `text` PRIMARY KEY | lowercase ASCII slug; nepromjenjiv; koristi se u storage putanji i kao FK vrijednost |
| `label` | `text NOT NULL` | prikazni naziv (dijakritika dozvoljena); jedinstven (case-insensitive) |
| `order_index` | `integer NOT NULL DEFAULT 0` | redoslijed u UI |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

- `UNIQUE` (lower(`label`)) — sprečava duplikate naziva.

### Migracija (jedan fajl `supabase/migrations/<ts>_gallery_categories.sql`)

1. `CREATE TABLE gallery_categories (...)`.
2. Seed postojećih 5: `('sminkanje','Šminkanje',1), ('svadbeno','Svadbeno',2), ('pedikir','Pedikir',3), ('trepavice','Trepavice',4), ('obuka','Obuka',5)`.
3. `ALTER TABLE gallery_images DROP CONSTRAINT gallery_images_category_check;`
4. `ALTER TABLE gallery_images ADD CONSTRAINT gallery_images_category_fkey FOREIGN KEY (category) REFERENCES gallery_categories(key) ON DELETE RESTRICT ON UPDATE CASCADE;`
5. RLS: `ENABLE ROW LEVEL SECURITY`; policy javni `SELECT` (anon+authenticated); admin `INSERT/UPDATE/DELETE` preko `public.is_admin()` (mirror obrasca iz `20260527000000_security_hardening.sql`).
6. Regenerisati tipove: `supabase gen types typescript --local > src/types/database.ts`.

Redoslijed koraka bitan: seed PRIJE dodavanja FK-a (inače postojeće slike krše FK).

## `key` vs `label` (slug pravila)

- Una unosi **samo `label`** (npr. „Mladenke"). `key` se auto-generiše: lowercase → skidanje dijakritike (š→s, đ→dj, č/ć→c, ž→z) → zamjena ne-alfanumerika sa `-` → trim. „Mladenke" → `mladenke`.
- Kolizija slug-a (npr. dvije različite labele daju isti key) → sufiks `-2`, `-3`, …
- `key` je **nepromjenjiv** poslije kreiranja. „Preimenovanje" mijenja **samo `label`** (storage putanje i postojeći redovi ostaju validni).

## Server akcije (`src/app/admin/(protected)/galerija/actions.ts`)

Sve: `requireAdmin()` prvo → Zod validacija → mutacija preko `createAdminClient()` → `updateTag(ADMIN_CACHE_TAGS.galleryCategories)` + `revalidatePath("/admin/galerija")` + `revalidatePath("/galerija")` → `ActionResult`.

- `createGalleryCategory(label: string)` — generiše key, provjeri jedinstvenost labele/key-a, `order_index = max+1`.
- `renameGalleryCategory(key: string, label: string)` — mijenja samo `label`; provjeri jedinstvenost.
- `reorderGalleryCategories(orderedKeys: string[])` — postavlja `order_index` po redoslijedu niza.
- `deleteGalleryCategory(key: string)` — `DELETE`; hvata FK `23503` grešku → vraća `{ ok:false, error:"Kategorija ima slike — premjesti ili obriši ih prije brisanja kategorije." }`.

Validacija (Zod): `label` 1–40 znakova, trim, ne-prazan; `key` mora postojati za rename/delete.

## Admin UI

Panel **„Kategorije"** na `/admin/galerija` (iznad ili pored upload sekcije), preko nove client komponente `GalleryCategoryManager.tsx`:

- Lista kategorija (label + broj slika) sa: inline rename (klik → input), strelice gore/dolje (reorder), dugme briši.
- „＋ Nova kategorija" — input za label → `createGalleryCategory`.
- Dugme briši: **disabled** ako kategorija ima ≥1 sliku (tooltip „ima N slika"); ako je prazna → potvrda pa brisanje.
- Upload dropdown u `GalleryManager.tsx` čita kategorije iz baze (ne više statički import).

Broj slika po kategoriji: jedan `count` upit grupisan po `category` (server-side, proslijeđen komponenti).

## Refaktor potrošača

`src/lib/gallery/categories.ts` više nije izvor liste:
- Ostaje slug helper (`slugifyCategory`) + tip `GalleryCategory = string`.
- Novi cached read `getCachedGalleryCategories()` u `src/lib/cache/cached-queries.ts` (`createAdminClient`, tag `galleryCategories`).
- Novi tag u `src/lib/cache/admin-cache-tags.ts`: `galleryCategories: "admin:gallery-categories"`.
- Tri potrošača čitaju dinamički:
  - `GalleryManager.tsx` (admin upload) — dropdown iz DB.
  - `GalleryGrid.tsx` (javni filter) — vidi „Javni filter" niže.
  - `galerija/actions.ts` `uploadSingleGalleryImage` — `isValidGalleryCategory` validira protiv **keširane DB liste** (app-nivo, prijateljska poruka); FK je DB-nivo backstop. `deriveAltText` mapa pokriva 5 seed kategorija, a za nove → fallback `UP Makeup — <label> Gradiška`.

## Javni filter (`GalleryGrid.tsx`)

- Prikazuje **samo kategorije koje imaju ≥1 sliku** (izbjegava praznu dugmad dok Una ne uploaduje). „Sve" ostaje na vrhu.
- Admin vidi sve kategorije (i prazne) u manageru.

## Keširanje

- `getCachedGalleryCategories()` — `unstable_cache` + tag `galleryCategories`.
- Sve 4 mutirajuće akcije zovu `updateTag(galleryCategories)` + `revalidatePath`.
- Javna `/galerija` (ISR `revalidate=300`) i admin čitanja se osvježavaju kroz tag/revalidate.

## Edge slučajevi

- Duplikat labele (case-insensitive) → odbij sa porukom.
- Prazan/whitespace label → odbij.
- Slug kolizija → auto-sufiks broj.
- Brisanje kategorije sa slikama → blokirano (FK), prijateljska poruka.
- `deriveAltText` (galerija upload): mapa keyword-alt-ova pokriva 5 seed kategorija; za **nove** kategorije fallback `UP Makeup — <label> Gradiška` (čita label iz DB ili koristi generički).

## Pogođeni fajlovi

- `supabase/migrations/<ts>_gallery_categories.sql` (novo)
- `src/types/database.ts` (regenerisano)
- `src/lib/gallery/categories.ts` (refaktor: slug helper, tip)
- `src/lib/cache/cached-queries.ts` (+`getCachedGalleryCategories`)
- `src/lib/cache/admin-cache-tags.ts` (+tag)
- `src/app/admin/(protected)/galerija/actions.ts` (+4 akcije, refaktor `deriveAltText`)
- `src/app/admin/(protected)/galerija/page.tsx` (render manager + broj slika)
- `src/components/admin/GalleryCategoryManager.tsx` (novo)
- `src/components/admin/GalleryManager.tsx` (dropdown iz DB)
- `src/components/public/GalleryGrid.tsx` (filter iz DB, samo ne-prazne)

## Testiranje

- **Unit:** `slugifyCategory` (dijakritika, kolizija, ne-alfanumerik, trim).
- **Migracija/DB:** lokalni Docker Supabase — primijeni migraciju, potvrdi seed (5), FK blokira brisanje ne-prazne kategorije (`ON DELETE RESTRICT`), dozvoli brisanje prazne.
- **E2E (opciono):** admin doda kategoriju → pojavi se u upload dropdown-u → upload slike → kategorija se pojavi u javnom filteru.
- Regresija: postojećih 60 slika i dalje validne (FK zadovoljen seed-om).

## Bezbjednost / rizici

- RLS na novoj tabeli (javno čitanje, admin upis) mirror je postojećeg obrasca.
- FK `ON DELETE RESTRICT` je primarna zaštita od gubitka slika.
- Migracija na produkciji: primijeniti tek nakon lokalnog testiranja (Docker), per CLAUDE.md „CRITICAL test safety rules".
