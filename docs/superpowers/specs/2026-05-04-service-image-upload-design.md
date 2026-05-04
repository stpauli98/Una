# Service Image Upload — Design

**Status:** Draft (awaiting user review)
**Date:** 2026-05-04
**Author:** Nikola Milošević + Claude Opus 4.7

## Problem

`ServiceCard` na landing page-u i `/usluge` ima placeholder gradijent + emoji ikonu na vrhu (`min-h-[120px]`). Admin nema mogućnost da postavi pravu sliku za uslugu — kartice izgledaju identično generičke. Cilj: omogućiti adminu da uploaduje sliku po usluzi koja se prikazuje umjesto gradijenta.

## Goals

- Admin može uploadovati sliku pri kreiranju **nove** usluge (opciono).
- Admin može dodati/zamijeniti/ukloniti sliku na **postojećoj** usluzi.
- Slika se prikazuje na javnoj `ServiceCard` u layout-u "iznad teksta".
- Usluge bez slike koriste postojeći gradijent + ikonu kao fallback.

## Non-goals

- Više slika po usluzi (sad samo jedna).
- Galerija slika za usluge (single image, replace flow).
- Auto-cropping/AI cropping — slika se postavlja `object-cover` i cropping je vizualan.
- Retroaktivno seedanje slika za postojećih 9 usluga (admin to radi manuelno kroz UI).

## Architecture

```
┌──────────────────────────────────────────────────┐
│  services tabela                                 │
│  id, name, ..., image_path text NULL  ← novo     │
└────────────┬─────────────────────────────────────┘
             │ image_path (npr. "12-7k3qm9.webp")
             ▼
┌──────────────────────────────────────────────────┐
│  storage bucket: services (public read)          │
│  └── 12-7k3qm9.webp  ← max 1200px, q=85, WebP   │
└──────────────────────────────────────────────────┘
```

Slika se referencira preko `image_path` koji sadrži storage filename (bez prefix-a). Public URL se gradi: `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/services/${image_path}`.

Storage path konvencija: `<id>-<random6>.webp`. ID prefiks olakšava manuelno čitanje u dashboard-u; random sufiks sprečava cache poisoning kad admin zamijeni sliku (preglednici i Vercel image optimizer mogu cache-ovati po URL-u 30 dana).

## Database changes

Novi migration fajl `supabase/migrations/20260504100000_service_image.sql`:

1. `ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_path text;` (nullable)
2. `INSERT INTO storage.buckets ... VALUES ('services', 'services', true, 5MB, ['image/webp', 'image/jpeg', 'image/png']) ON CONFLICT DO UPDATE`
3. 4 RLS policies (public read; authenticated insert/update/delete) — copy iz `gallery` migracije

## Storage / image pipeline

**Klijentska kompresija** (postojeća dependency `browser-image-compression`):
- max 2MB, max 1200px, target WebP
- Cilj: izbjeći 5MB body limit + ubrzati upload

**Server (sharp):**
```ts
sharp(buffer)
  .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 85 })
  .toBuffer();
```
Tipičan output: 80-200 KB. Manje od galerije (1920px / q=88) jer kartice nisu primary content.

**Validacija (server):**
- max 5MB pre-resize
- max 4096×4096 pre-resize (sharp metadata)
- format jpeg/png/webp

## Server actions

Lokacija: `src/app/admin/(protected)/usluge/actions.ts`.

### `createService(formData)`

```
1. requireAdmin()
2. parseFormData() — bez image polja
3. INSERT into services (vraća id)
4. Ako formData.get("image") je File:
     - sharp pipeline → webp buffer
     - storage.upload("services", `${id}-${rand}.webp`, buffer)
     - UPDATE services SET image_path = ... WHERE id = ${id}
   Ako upload propadne: DELETE services WHERE id = ${id} (rollback) + return error
5. revalidatePath("/admin/usluge", "/", "/usluge", "/cjenovnik")
```

### `updateService(id, formData)`

```
1. requireAdmin()
2. SELECT image_path FROM services WHERE id (čuvaj kao oldPath)
3. UPDATE services (svi tekst polja, BEZ image_path)
4. Branch:
   a. Ako formData.get("removeImage") === "true":
        - storage.remove([oldPath]) ako oldPath
        - UPDATE services SET image_path = NULL
   b. Inače ako formData.get("image") je novi File:
        - sharp pipeline → webp buffer
        - newPath = `${id}-${rand}.webp`
        - storage.upload(newPath, buffer)  ← MORA uspjeti prije sledećeg koraka
        - UPDATE services SET image_path = newPath
        - storage.remove([oldPath]) ako oldPath  ← log on error, ne rollback
   c. Inače: skip slika branch
5. revalidatePath(...)
```

**Invariant:** stara slika se briše tek nakon uspješnog uploada nove (bez "lost in transit" perioda).

### `deleteService(id)` — proširenje postojećeg

```
1. requireAdmin()
2. SELECT image_path FROM services WHERE id
3. DELETE FROM services WHERE id (RESTRICT FK može propasti ako ima appointments → return error)
4. Ako image_path: storage.remove([image_path]) — log on error, ne rollback
5. revalidatePath(...)
```

## UI: Admin `ServiceForm.tsx`

Novi sekcija u formu, prije "Cijena (KM)" polja.

**State (klijent):**
```ts
type ImageState =
  | { mode: "none" }                              // bez slike, ništa ne mijenja
  | { mode: "existing"; path: string; url: string }  // postojeća, ostaje
  | { mode: "replace"; file: File; previewUrl: string }  // nova bira
  | { mode: "remove" }                             // ukloniti pri save-u
```

**Stanja UI:**

1. **`none`** (create mode): drag/drop zona slična gallery-ju. Tekst: "Prevucite sliku ili kliknite · JPG/PNG/WebP · max 5MB · opciono".
2. **`existing`** (edit mode, ima sliku): thumb 80×80 (plain `<img>` jer je modal), naziv path, dugme **Zamijeni**, dugme **Ukloni**.
3. **`replace`**: thumb novog fajla (preview iz `URL.createObjectURL`), naziv, dugme **Otkaži zamjenu** (vraća na `existing` ili `none`).
4. **`remove`**: tekst "Slika će biti uklonjena pri save-u", dugme **Vrati** (vraća na `existing`).

**FormData submit:**
- `mode === "replace"`: postavi `image` File u FormData
- `mode === "remove"`: postavi `removeImage=true`
- `mode === "existing"` ili `none`: ništa (server ne mijenja)

**Klijentska kompresija:** kad fajl ude u `replace` state, prolazi kroz `imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1200, useWebWorker: true, fileType: "image/webp" })` prije nego što ide u state — ista logika kao GalleryManager.

## UI: Public `ServiceCard.tsx`

Refactor: dodaje opciono `imageUrl?: string` prop. Parent (page.tsx, usluge/page.tsx) gradi URL kao za gallery.

```tsx
type Props = {
  service: Service;
  imageUrl?: string;  // novo, opciono
  featured?: boolean;
  headingLevel?: "h3" | "h4";
};

// U JSX-u:
{imageUrl ? (
  <div className="relative h-[160px] overflow-hidden">
    <Image
      src={imageUrl}
      alt={service.name}
      fill
      quality={90}
      sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
      className="object-cover"
    />
  </div>
) : (
  // postojeći gradijent + ikona
  <div className="flex min-h-[120px] items-center justify-center bg-gradient-to-br from-blush to-pink">
    <span className="text-[36px] font-light text-white/70">{icon}</span>
  </div>
)}
```

**Bitno:**
- Sa slikom: `h-[160px]` (više od `min-h-[120px]`) — slika ima više prostora.
- `quality={90}` koristi `qualities: [75, 90]` config (već u main-u kroz PR #8).
- `<Image>` `onError` handler nije moguće u Server Component-u; broken image (out-of-band obrisan fajl) prikazuje broken icon. Mitigacija: kad admin obriše uslugu, brišemo i sliku, pa orphan image_path → fajl ne postoji situacija je rijetka. Out-of-scope: cron za cleanup orphans.

**Parents** (`page.tsx`, `usluge/page.tsx`): dodaju mapping
```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const services = (data ?? []).map(s => ({
  ...s,
  imageUrl: s.image_path
    ? `${supabaseUrl}/storage/v1/object/public/services/${s.image_path}`
    : undefined,
}));
```

## Error handling

| Scenarij | Ponašanje |
|---|---|
| Sharp ne može parsati (corrupt) | Create rollback; update zadržava staru |
| Storage upload propadne | Create rollback; update zadržava staru, vraća error |
| INSERT prošao, upload pao | DELETE services WHERE id = X (rollback) |
| Stara slika fail brisanja pri update | Log, ne rollback (orphan nije UX issue) |
| Stara slika fail brisanja pri delete service | Isto — log + nastavi |
| File > 5MB | "Slika prelazi 5 MB" |
| Format ≠ jpg/png/webp | "Neispravan format slike" |
| Klijent compression propala (Safari) | Server svejedno re-encodira |
| Out-of-band brisanje fajla iz storage-a | Broken image u browser; mitigacija out-of-scope |

## Testing

**Unit (Vitest):**
- `parseFormData` proširen za `removeImage` flag — pozitivni i negativni test
- Postojeći testovi za usluge ostaju nepromijenjeni (image polja su opciona)

**E2E (Playwright):**
- `services-with-image.spec.ts` — admin kreira uslugu sa slikom, provjerava `image_path` u DB-u + da fajl postoji u storage-u
- `services-remove-image.spec.ts` — admin otvori uslugu sa slikom, klikne Ukloni → save → `image_path = NULL` i fajl obrisan

## Out of scope

- Više slika po usluzi
- Crop UI / aspect-ratio enforcement na admin strani
- Retroaktivno seedanje slika za postojećih 9 usluga (admin to radi manuelno)
- Cron za cleanup orphan slika u storage-u
- Lazy loading optimizacije izvan onoga što `next/image` daje by default

## Rollout

1. PR sa migracijom + actions + UI promjene
2. Mergeuj → Vercel deploy → migracija se aplicira preko Supabase CLI ili dashboard-a
3. Postojeće usluge imaju `image_path = NULL` → fallback gradijent (bez vizualne razlike za korisnika)
4. Admin postupno uploaduje slike za 9 usluga preko admin panela
5. Kako se slike dodaju, kartice na sajtu počinju da pokazuju prave slike

Nema breaking change-a, nema migracija podataka.
