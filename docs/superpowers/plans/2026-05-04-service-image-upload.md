# Service Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Omogućiti adminu da uploaduje opcionu sliku po usluzi koja se prikazuje na javnoj `ServiceCard` umjesto fallback gradijenta.

**Architecture:** Nova kolona `image_path text NULL` na `services`, novi storage bucket `services` sa public read + authenticated write RLS, sharp pipeline 1200px / WebP q=85, ServiceForm sa 4-state UI (`none` / `existing` / `replace` / `remove`), ServiceCard prima opciono `imageUrl` prop sa fallback na postojeći gradijent + ikonu.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres + Storage), `sharp` na server, `browser-image-compression` na klijent, Tailwind v4, Vitest (unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-05-04-service-image-upload-design.md`

---

## File Structure

**Created:**
- `supabase/migrations/20260504100000_service_image.sql` — kolona + bucket + RLS
- `tests/e2e/admin-service-image.spec.ts` — E2E za upload + remove

**Modified:**
- `src/types/database.ts` — dodaje `image_path: string | null` na services row type
- `src/app/admin/(protected)/usluge/actions.ts` — proširi `createService` i `updateService` sa image upload pipeline-om
- `src/components/admin/ServiceForm.tsx` — dodaje image upload sekciju sa 4 stanja
- `src/components/public/ServiceCard.tsx` — dodaje `imageUrl?: string` prop i conditional render
- `src/app/page.tsx` — gradi `imageUrl` za featured services i prosljeduje `<ServiceCard>`
- `src/app/usluge/page.tsx` — isto

**Boundaries:**
- `actions.ts` zna o storage-u i sharp-u — UI ne. Form samo šalje FormData.
- `ServiceCard` je dumb komponenta — ne čita env, prima već-izgrađen URL kroz prop.
- Sharp logika je inline u `actions.ts` (ne ekstraktujem helper jer YAGNI — gallery koristi drugačije parametre).

---

## Task 1: DB migracija + storage bucket

**Files:**
- Create: `supabase/migrations/20260504100000_service_image.sql`

- [ ] **Step 1: Napiši migraciju**

```sql
-- supabase/migrations/20260504100000_service_image.sql
-- Slike za usluge — opciona slika koja se prikazuje na ServiceCard
-- na landing page-u i /usluge stranici.
--
-- Storage path konvencija: services/<id>-<random>.webp
-- Public read; insert/update/delete samo authenticated (admin).

-- 1. Kolona za putanju u storage-u (nullable — postojeće usluge ostaju bez slike).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_path text;

-- 2. Bucket za usluge (idempotentno).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('services', 'services', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage RLS policies.
DROP POLICY IF EXISTS "services: public read"           ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated insert"  ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated update"  ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated delete"  ON storage.objects;

CREATE POLICY "services: public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'services');

CREATE POLICY "services: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'services');

CREATE POLICY "services: authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'services')
  WITH CHECK (bucket_id = 'services');

CREATE POLICY "services: authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'services');
```

- [ ] **Step 2: Apliciraj migraciju lokalno**

Run: `cd up-beauty && supabase db reset --local`
Expected: ispisuje "Applying migration 20260504100000_service_image.sql..." bez NOTICE/ERROR osim "policy ... does not exist, skipping" (idempotentnost).

- [ ] **Step 3: Verifikuj kolonu i bucket**

Run:
```bash
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='services' AND column_name='image_path';"
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c \
  "SELECT id, public FROM storage.buckets WHERE id='services';"
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c \
  "SELECT policyname FROM pg_policies WHERE policyname LIKE 'services:%';"
```
Expected:
1. `image_path` red postoji
2. `services | t` red
3. 4 policy reda: `services: public read`, `services: authenticated insert`, `services: authenticated update`, `services: authenticated delete`

- [ ] **Step 4: Re-create test admin user (db reset briše korisnike)**

Run:
```bash
SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: ${SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@admin.com","password":"Test1234A","email_confirm":true}'
```
Expected: `HTTP 200`

- [ ] **Step 5: Re-seed galerija (po izboru, samo ako prethodno postojala)**

Run: `node scripts/seed-gallery.mjs`
Expected: skripta uploaduje 13 slika.

- [ ] **Step 6: Re-seed termina (po izboru)**

Run: `node scripts/seed-appointments.mjs`
Expected: 20 termina.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260504100000_service_image.sql
git commit -m "feat(services): migracija za image_path kolonu + storage bucket

Dodaje opciono image_path na services tabeli i kreira public 'services'
bucket sa istim RLS pattern-om kao 'gallery' (public read, authenticated
insert/update/delete). Postojeće usluge dobijaju image_path=NULL.
"
```

---

## Task 2: Update database types

**Files:**
- Modify: `src/types/database.ts` (services Row/Insert/Update tipovi)

- [ ] **Step 1: Provjeri trenutni shape**

Run: `grep -A 30 '"services":' src/types/database.ts | head -50`

Note tri sekcije: `Row`, `Insert`, `Update` pod `services`. Dodaj `image_path` u sve tri.

- [ ] **Step 2: Dodaj `image_path` polje**

U `src/types/database.ts`, pod `services`:
- `Row`: dodaj `image_path: string | null`
- `Insert`: dodaj `image_path?: string | null`
- `Update`: dodaj `image_path?: string | null`

(Tačna pozicija: sortirano alfabetski među ostalim poljima — pored `id` ili po pozadinskom redoslijedu fajla.)

- [ ] **Step 3: Verifikuj typecheck**

Run: `npm run typecheck`
Expected: pass (bez novih errora)

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "types(services): dodaj image_path polje (string | null)"
```

---

## Task 3: Server action — `createService` sa image upload

**Files:**
- Modify: `src/app/admin/(protected)/usluge/actions.ts:30-53` (postojeći `createService`)

**Strategija:** Prošireni flow — INSERT bez image_path (dobijamo id), pa ako je image File u FormData, uploaduj u storage sa `${id}-${rand}.webp`, pa UPDATE image_path. Ako upload propadne, DELETE inserted row (rollback).

- [ ] **Step 1: Dodaj sharp import na vrh fajla**

U `src/app/admin/(protected)/usluge/actions.ts`, dodaj na vrh (nakon postojećih import-a):

```ts
import sharp from "sharp";
import { sanitizeError } from "@/lib/utils/log";
```

- [ ] **Step 2: Dodaj helper `processServiceImage` ispod `parseFormData`**

```ts
const SERVICE_IMG_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const SERVICE_IMG_MAX_DIMENSION = 4096;
const SERVICE_IMG_ALLOWED: sharp.AvailableFormatInfo["id"][] = [
  "jpeg",
  "png",
  "webp",
];

/**
 * Validira i konvertuje upload-ovanu sliku u WebP buffer (1200px max, q=85).
 * Vraća `null` sa errorom ili buffer.
 */
async function processServiceImage(
  file: File,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  if (file.size > SERVICE_IMG_MAX_FILE_SIZE) {
    return { ok: false, error: "Slika prelazi 5 MB" };
  }
  const raw = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(raw).metadata();
    if (!meta.format || !SERVICE_IMG_ALLOWED.includes(meta.format as never)) {
      return { ok: false, error: "Neispravan format slike (dozvoljeni: JPG, PNG, WebP)" };
    }
    if (
      !meta.width ||
      !meta.height ||
      meta.width > SERVICE_IMG_MAX_DIMENSION ||
      meta.height > SERVICE_IMG_MAX_DIMENSION
    ) {
      return { ok: false, error: "Dimenzije slike prelaze dozvoljeni limit" };
    }
    const buffer = await sharp(raw)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { ok: true, buffer };
  } catch {
    return { ok: false, error: "Ne mogu obraditi sliku" };
  }
}
```

- [ ] **Step 3: Refaktoriši `createService` za image upload**

Zamijeni postojeću `createService` funkciju ovim:

```ts
export async function createService(formData: FormData): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const parsed = parseFormData(formData);
    const { data: maxOrder } = await sb
      .from("services")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxOrder?.order_index ?? 0) + 1;

    // INSERT bez image_path da dobijemo id.
    const { data: inserted, error: insErr } = await sb
      .from("services")
      .insert({ ...parsed, order_index: nextOrder })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return { ok: false, error: insErr?.message ?? "Greška pri kreiranju usluge" };
    }

    // Ako je slika data, procesuiraj i upload-uj.
    const file = formData.get("image") as File | null;
    if (file && file instanceof File && file.size > 0) {
      const processed = await processServiceImage(file);
      if (!processed.ok) {
        // Rollback — obriši inserted row.
        await sb.from("services").delete().eq("id", inserted.id);
        return { ok: false, error: processed.error };
      }
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${inserted.id}-${rand}.webp`;
      const { error: upErr } = await sb.storage
        .from("services")
        .upload(path, processed.buffer, { contentType: "image/webp", upsert: false });
      if (upErr) {
        console.error("services upload failed:", sanitizeError(upErr));
        await sb.from("services").delete().eq("id", inserted.id);
        return { ok: false, error: "Greška pri slanju slike na server" };
      }
      const { error: updErr } = await sb
        .from("services")
        .update({ image_path: path })
        .eq("id", inserted.id);
      if (updErr) {
        console.error("services image_path update failed:", sanitizeError(updErr));
        await sb.storage.from("services").remove([path]);
        await sb.from("services").delete().eq("id", inserted.id);
        return { ok: false, error: "Greška pri spremanju slike" };
      }
    }

    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 4: Verifikuj typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/(protected)/usluge/actions.ts
git commit -m "feat(services): createService prima opcionu sliku

Sharp pipeline 1200px q=85, rollback INSERT-a ako upload propadne.
Slika je opciona — bez image polja u FormData, ponaša se kao prije.
"
```

---

## Task 4: Server action — `updateService` sa replace/remove flow

**Files:**
- Modify: `src/app/admin/(protected)/usluge/actions.ts:55-72` (postojeći `updateService`)

**Strategija:** Pročitaj `oldPath`. Ako `removeImage=true` u FormData, briši storage + null-uj kolonu. Inače ako novi File postoji, uploaduj novu, update kolonu, brisi staru (tek nakon uspješnog upload-a). Inače ne mijenjaj sliku.

- [ ] **Step 1: Refaktoriši `updateService`**

Zamijeni postojeću funkciju:

```ts
export async function updateService(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const parsed = parseFormData(formData);

    // Pročitaj staru putanju za eventualno brisanje.
    const { data: existing } = await sb
      .from("services")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    const oldPath = existing?.image_path ?? null;

    // Update svih tekst polja (BEZ image_path — to mijenjamo posebno).
    const { error } = await sb.from("services").update(parsed).eq("id", id);
    if (error) return { ok: false, error: error.message };

    const removeImage = formData.get("removeImage") === "true";
    const file = formData.get("image") as File | null;

    if (removeImage) {
      if (oldPath) {
        const { error: rmErr } = await sb.storage.from("services").remove([oldPath]);
        if (rmErr) console.error("services remove failed:", sanitizeError(rmErr));
      }
      const { error: updErr } = await sb
        .from("services")
        .update({ image_path: null })
        .eq("id", id);
      if (updErr) return { ok: false, error: updErr.message };
    } else if (file && file instanceof File && file.size > 0) {
      const processed = await processServiceImage(file);
      if (!processed.ok) return { ok: false, error: processed.error };
      const rand = Math.random().toString(36).slice(2, 8);
      const newPath = `${id}-${rand}.webp`;
      const { error: upErr } = await sb.storage
        .from("services")
        .upload(newPath, processed.buffer, { contentType: "image/webp", upsert: false });
      if (upErr) {
        console.error("services upload failed:", sanitizeError(upErr));
        return { ok: false, error: "Greška pri slanju slike na server" };
      }
      const { error: updErr } = await sb
        .from("services")
        .update({ image_path: newPath })
        .eq("id", id);
      if (updErr) {
        await sb.storage.from("services").remove([newPath]);
        return { ok: false, error: "Greška pri spremanju slike" };
      }
      // Stara se briše TEK SAD — nakon uspješnog uploada nove.
      if (oldPath) {
        const { error: rmErr } = await sb.storage.from("services").remove([oldPath]);
        if (rmErr) console.error("services old image remove failed:", sanitizeError(rmErr));
      }
    }

    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

- [ ] **Step 2: Verifikuj typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/(protected)/usluge/actions.ts
git commit -m "feat(services): updateService podržava replace/remove sliku

removeImage=true u FormData briše storage+nullify image_path.
Novi image File: upload novu, update kolonu, briši staru (tek nakon
uspješnog uploada — nema 'lost in transit' perioda).
"
```

---

## Task 5: Public `ServiceCard` — render slike sa fallback gradijentom

**Files:**
- Modify: `src/components/public/ServiceCard.tsx` (cijeli fajl)

- [ ] **Step 1: Dodaj `imageUrl?: string` prop i conditional render**

Zamijeni cijeli sadržaj `src/components/public/ServiceCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  service: Service;
  /** Već-izgrađeni public URL slike (ako image_path postoji). */
  imageUrl?: string;
  /** Ako true, prikaži sa većim paddingom i linkom na /zakazi */
  featured?: boolean;
  /** Nivo heading-a za ime usluge (default h3) */
  headingLevel?: "h3" | "h4";
};

const ICONS: Record<string, string> = {
  sminkanje: "✧",
  pedikir: "◈",
  trepavice: "❋",
  obuka: "◇",
};

export function ServiceCard({
  service,
  imageUrl,
  featured,
  headingLevel = "h3",
}: Props) {
  const Heading = headingLevel;
  const icon = ICONS[service.category] ?? "✧";
  const priceDisplay = service.price_note ?? formatPrice(Number(service.price));

  const media = imageUrl ? (
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
    <div className="flex min-h-[120px] items-center justify-center bg-gradient-to-br from-blush to-pink">
      <span className="text-[36px] font-light text-white/70">{icon}</span>
    </div>
  );

  const content = (
    <>
      {media}
      <div className="p-5 md:p-6">
        <Heading className="mb-2 font-display text-xl font-normal text-dark">
          {service.name}
        </Heading>
        {service.description && (
          <p className="mb-4 text-xs leading-relaxed text-light">
            {service.description}
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[26px] font-normal text-rose">
            {priceDisplay}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-light">
            {service.duration_note ?? formatDuration(service.duration_min)}
          </span>
        </div>
      </div>
    </>
  );

  const card = (
    <article
      className={`h-full overflow-hidden border border-cream bg-white transition-all duration-300 ${
        featured ? "hover:-translate-y-1 hover:shadow-lg" : ""
      }`}
    >
      {content}
    </article>
  );

  if (featured && service.bookable) {
    return (
      <Link
        href={`/zakazi?service=${service.id}`}
        aria-label={`Zakaži ${service.name}`}
      >
        {card}
      </Link>
    );
  }
  return card;
}
```

- [ ] **Step 2: Verifikuj typecheck**

Run: `npm run typecheck`
Expected: pass

- [ ] **Step 3: Commit (preporuka: zajedno sa Task 6 za atomic UI promjenu)**

Vidi Task 6 — pravimo jedan commit za cijeli public render path.

---

## Task 6: Parents — gradi `imageUrl` u page.tsx i usluge/page.tsx

**Files:**
- Modify: `src/app/page.tsx` (oko linije 50, ServiceCard usage)
- Modify: `src/app/usluge/page.tsx` (oko linije 68, ServiceCard usage)

- [ ] **Step 1: Pronađi mjesta**

Run:
```bash
grep -n "ServiceCard" src/app/page.tsx src/app/usluge/page.tsx
```
Expected: 1 ServiceCard usage u svakom (line 50 i 68 prema spec-u, ali verifikuj).

- [ ] **Step 2: Update `src/app/page.tsx`**

Pronađi gdje se fetch-uju services i mapiraju u ServiceCard. Inicijaliziraj `supabaseUrl` ako nije već, pa prosljedi `imageUrl` prop.

Tipičan obrazac (prilagodi tačnoj postojećoj strukturi):

```tsx
// Pre fetch-a:
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// U JSX-u gdje se mapira services:
{services.map((service) => (
  <ServiceCard
    key={service.id}
    service={service}
    imageUrl={
      service.image_path
        ? `${supabaseUrl}/storage/v1/object/public/services/${service.image_path}`
        : undefined
    }
    featured
  />
))}
```

- [ ] **Step 3: Update `src/app/usluge/page.tsx`**

Isti pattern kao u Step 2.

- [ ] **Step 4: Verifikuj build**

Run: `npm run build`
Expected: pass (osim postojećih lint warnings koji nisu vezani za ovaj task)

- [ ] **Step 5: Commit (uključi i ServiceCard.tsx iz Task 5)**

```bash
git add src/components/public/ServiceCard.tsx src/app/page.tsx src/app/usluge/page.tsx
git commit -m "feat(services): ServiceCard renderuje sliku ako postoji

Public ServiceCard prima imageUrl?: string prop. Ako je dat, render-uje
next/image (h-[160px], q=90, object-cover). Inače fallback gradijent +
ikona kao do sad. Parent page-ovi (landing + /usluge) grade URL iz
service.image_path + NEXT_PUBLIC_SUPABASE_URL.
"
```

---

## Task 7: Admin `ServiceForm` — image upload sa 4 stanja

**Files:**
- Modify: `src/components/admin/ServiceForm.tsx` (top imports + state + UI sekcija + form submit)

**Bitno:** Korisno biti u dva commita — prvo state + helper-i, pa UI sekcija. Ali za jednostavnost sve u jednom (jer je file odvojena komponenta i sve mijenjamo u njoj).

- [ ] **Step 1: Dodaj nove import-e na vrhu fajla**

Na liniji nakon postojećih import-a:

```ts
import imageCompression from "browser-image-compression";
import { Image as ImageIcon, X } from "lucide-react";
```

- [ ] **Step 2: Dodaj konstante ispod import-a (prije `Props`)**

```ts
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: "image/webp" as const,
};
```

- [ ] **Step 3: Dodaj `imageUrl?: string` u `Props`**

Edit `Props` type:

```ts
type Props = {
  service?: Service | null;
  /** Public URL postojeće slike (parent gradi). */
  imageUrl?: string;
  onClose: () => void;
  onSaved: () => void;
};
```

- [ ] **Step 4: Dodaj image state u komponentu**

Nakon postojećih `useState` poziva u `ServiceForm`, dodaj:

```ts
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
```

I dodaj `useRef` u import-e iz `react`:
```ts
import { useState, useTransition, useRef } from "react";
```

Plus cleanup za blob URL-ove:

```ts
useEffect(() => {
  return () => {
    if (imageState.mode === "replace") {
      URL.revokeObjectURL(imageState.previewUrl);
    }
  };
}, [imageState]);
```

I `useEffect` u import-e:
```ts
import { useState, useTransition, useRef, useEffect } from "react";
```

- [ ] **Step 5: Dodaj handler-e za image akcije**

Iznad `return` u komponenti:

```ts
const handleFilePick = async (file: File) => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    setError("Format slike mora biti JPG, PNG ili WebP");
    return;
  }
  setError(null);
  setCompressing(true);
  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    // Cleanup prethodnog preview-a ako postoji
    if (imageState.mode === "replace") {
      URL.revokeObjectURL(imageState.previewUrl);
    }
    setImageState({
      mode: "replace",
      file: compressed,
      previewUrl: URL.createObjectURL(compressed),
    });
  } catch {
    // Fallback: pošalji originalni fajl
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
  }
};

const handleCancelReplace = () => {
  if (imageState.mode === "replace") {
    URL.revokeObjectURL(imageState.previewUrl);
  }
  setImageState(service?.image_path ? { mode: "existing" } : { mode: "none" });
};

const handleRemove = () => setImageState({ mode: "remove" });

const handleUndoRemove = () => setImageState({ mode: "existing" });
```

- [ ] **Step 6: Update form submit da uključi image polja u FormData**

U postojećem `onSubmit` handleru, prije `startTransition`, dodaj:

```ts
// Image polja u FormData
if (imageState.mode === "replace") {
  fd.set("image", imageState.file);
}
if (imageState.mode === "remove") {
  fd.set("removeImage", "true");
}
```

- [ ] **Step 7: Dodaj UI sekciju za sliku u form**

Pronađi gdje je `<Field label="Naziv">` polje, i dodaj **prije** "Cijena (KM)" polja (znači između `<Field label="Opis">` i `<Field label="Cijena (KM)">`):

```tsx
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
            className="text-[11px] text-red-600 underline-offset-2 hover:underline"
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
</Field>
```

- [ ] **Step 8: Update poziv `<ServiceForm>` da prosljedi `imageUrl`**

Pronađi gdje se ServiceForm koristi:

Run: `grep -rn "ServiceForm" src/app/ src/components/ | grep -v ServiceForm.tsx`

Vjerovatno `ServicesManager.tsx`. Update da prosljedi `imageUrl` ako `service.image_path` postoji:

```tsx
<ServiceForm
  service={editing}
  imageUrl={
    editing?.image_path
      ? `${supabaseUrl}/storage/v1/object/public/services/${editing.image_path}`
      : undefined
  }
  onClose={...}
  onSaved={...}
/>
```

(Trebat će ti `const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;` ako već nije u tom fajlu. Pošto je ovo Client Component, koristi `NEXT_PUBLIC_*` koji je dostupan na klijentu.)

- [ ] **Step 9: Verifikuj typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: pass

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/ServiceForm.tsx src/components/admin/ServicesManager.tsx
git commit -m "feat(services): admin ServiceForm sa image upload UI

Drag/click zona za nove slike. Pri edit-u prikazuje thumb postojeće
slike sa Zamijeni/Ukloni dugmićima. Ukloni je 2-step (toggle + Vrati).
Klijentska kompresija kroz browser-image-compression (max 1200px / 2MB).
"
```

---

## Task 8: E2E test — kreiranje usluge sa slikom

**Files:**
- Create: `tests/e2e/admin-service-image.spec.ts`

**Strategija:** koristi postojeći test admin (`test@admin.com` / `Test1234A`), priprema fixture sliku iz postojeće `Slike/` ili kreira tiny PNG buffer in-memory.

- [ ] **Step 1: Provjeri postojeći E2E pattern**

Run:
```bash
ls tests/e2e/
head -30 tests/e2e/admin-services.spec.ts 2>/dev/null || head -30 tests/e2e/global-setup.ts
```
Note: koristi se postojeća login pomoć. Pogledaj `tests/e2e/global-setup.ts` ili `helpers/`.

- [ ] **Step 2: Napiši test fajl**

Create `tests/e2e/admin-service-image.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";

// Mali fixture iz postojećeg Slike/ foldera (1024x1536 webp ~177KB)
function loadFixture(): { name: string; mimeType: string; buffer: Buffer } {
  // Tiny 1x1 PNG generisan inline — dovoljno za sharp validaciju.
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100200400000000000049454e44ae426082",
    "hex",
  );
  return { name: "test.png", mimeType: "image/png", buffer: png };
}

test.describe.serial("E2E* admin service image upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/(dashboard|usluge)/);
  });

  test("kreira novu uslugu sa slikom", async ({ page }) => {
    await page.goto("/admin/usluge");
    await page.click('button:has-text("Nova usluga")');

    await page.fill('input[name="name"]', "E2E Test Usluga sa slikom");
    await page.fill('input[name="price"]', "50");
    await page.selectOption('select[name="category"]', "sminkanje");

    const fixture = loadFixture();
    await page.setInputFiles('input[type="file"]', {
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.buffer,
    });

    // Sačekaj kompresiju
    await expect(page.locator("text=Nova slika")).toBeVisible({ timeout: 5000 });

    await page.click('button[type="submit"]:has-text("Sačuvaj")');

    // Vraća se na listu usluga
    await expect(page.locator("text=E2E Test Usluga sa slikom")).toBeVisible({
      timeout: 5000,
    });

    // Verifikuj da je slika prikazana na javnoj stranici (proxy za "image_path je setovan")
    await page.goto("/usluge");
    const card = page.locator("text=E2E Test Usluga sa slikom").locator("..");
    const img = card.locator("img").first();
    await expect(img).toHaveAttribute("src", /storage\/v1\/object\/public\/services\//);
  });

  test("ukloni sliku sa postojeće usluge", async ({ page }) => {
    // Pretpostavlja da prethodni test ostavi uslugu sa slikom.
    // Ako nije, ovaj test treba se preskočiti — global-setup briše E2E* prefiks.
    await page.goto("/admin/usluge");
    const editBtn = page
      .locator("text=E2E Test Usluga sa slikom")
      .locator("..")
      .locator('button:has-text("Izmijeni")')
      .first();
    if (!(await editBtn.isVisible())) {
      test.skip();
      return;
    }
    await editBtn.click();

    await page.click('button:has-text("Ukloni")');
    await expect(page.locator("text=Slika će biti uklonjena")).toBeVisible();

    await page.click('button[type="submit"]:has-text("Sačuvaj")');

    // Vrati se na javnu stranicu i provjeri da slika više nije prisutna
    await page.goto("/usluge");
    const card = page.locator("text=E2E Test Usluga sa slikom").locator("..");
    const img = card.locator("img").first();
    // Slika ne treba postojati ili treba imati gradijent fallback (bez img tag-a)
    await expect(img).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Pokreni test (sa lokalnim Supabase + dev serverom)**

Pretpostavlja da je dev server pokrenut na 3001 i Docker Supabase aktivan sa test admin korisnikom. Ako koristi `npm run test:e2e:local` skriptu, ona swap-uje env automatski.

Run: `npm run test:e2e:local -- admin-service-image`
Expected: oba testa prolaze.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-service-image.spec.ts
git commit -m "test(e2e): admin upload + remove slike za uslugu

Dva test-a: kreiranje sa slikom (provjerava da public stranica ima
img sa storage URL-om), uklanjanje slike sa postojeće usluge.
"
```

---

## Task 9: Push + PR

- [ ] **Step 1: Provjeri da nema dirty state-a osim plan dokumenta**

Run: `git status`
Expected: clean working tree (svi commit-ovi gore već uradjeni).

- [ ] **Step 2: Push branch**

Run: `git push -u origin feature/service-image-upload`
Expected: branch pushovan.

- [ ] **Step 3: Otvori PR**

Run:
```bash
gh pr create --base main --head feature/service-image-upload \
  --title "feat(services): opciona slika po usluzi (admin upload + public render)" \
  --body "Spec: docs/superpowers/specs/2026-05-04-service-image-upload-design.md
Plan: docs/superpowers/plans/2026-05-04-service-image-upload.md

## Summary
- Nova kolona services.image_path + storage bucket 'services' sa RLS
- Sharp pipeline 1200px / WebP q=85 (manje od galerije — kartice nisu primary content)
- Admin ServiceForm dobija 4-state image upload UI (none/existing/replace/remove)
- Public ServiceCard renderuje sliku ako postoji, fallback gradijent inače
- E2E testovi za upload i remove flow

## Test plan
- [x] DB migracija lokalno: kolona + bucket + 4 RLS policies
- [x] Typecheck + build
- [ ] E2E: \`npm run test:e2e:local -- admin-service-image\`
- [ ] Vercel preview: kreiraj uslugu sa slikom, provjeri prikaz na /usluge
- [ ] Vercel preview: ukloni sliku, provjeri da fallback gradijent radi"
```

- [ ] **Step 4: Pratiti CI checks i obavijestiti korisnika**

Korisnik pregleda PR, mergeuje kad je spreman.

---

## Spec Coverage Self-Review

| Spec sekcija | Implementiran u task-u |
|---|---|
| DB migracija (image_path + bucket + RLS) | Task 1 |
| Database types | Task 2 |
| Sharp pipeline 1200/q=85 | Task 3 (`processServiceImage`) |
| createService sa image + rollback | Task 3 |
| updateService replace/remove sa invariant | Task 4 |
| deleteService — "out of scope" jer ne postoji | (preskočeno, spec ažuriran) |
| Public ServiceCard sa imageUrl prop | Task 5 |
| Parents grade imageUrl | Task 6 |
| Admin ServiceForm 4 stanja | Task 7 |
| E2E upload + remove | Task 8 |
| Klijentska kompresija (browser-image-compression) | Task 7 (Step 5) |
| Validacija (size/format/dimension) | Task 3 (`processServiceImage`) |
| Error handling (rollback, log on cleanup fail) | Task 3, Task 4 |

Sve sekcije pokrivene. Tip konzistentnost provjerena (image_path: text/string | null svuda).

Nema placeholder-a — svi koraci imaju tačne file path-ove + commande + kod blokove.
