# Admin: `/admin/galerija` — Galerija management

**Fajl:** `src/app/admin/(protected)/galerija/page.tsx`, `src/components/admin/GalleryManager.tsx`

Upload, organizacija i brisanje slika u galeriji.

## Šta Una vidi

### Header

- `PageHeader` "Galerija"
- Category filter (Šminkanje, Svadbeno, Pedikir, Trepavice)

### Upload zone

Drag-and-drop zona ili klik za file picker:

```
┌─────────────────────────────┐
│         📤                  │
│  Prevucite slike ovdje      │
│  ili kliknite za odabir     │
│                             │
│  JPG, PNG ili WebP          │
│  Max 20 slika               │
│  Auto-kompresija na 1600px  │
└─────────────────────────────┘
```

### Lista slika

Grid kao na javnoj galeriji (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`), sa preklapanjem za select mode i delete:

- Hover: prikazuje delete dugme
- Klik (normal mode): otvori lightbox
- Klik (select mode): toggle selection

### Select mode

Toggle dugme "Izaberi" → svaki klik na sliku označava ili odznačava.

Toolbar gore:
- "Izaberi sve (N)"
- "Obriši (N)" (batch delete dugme — crveno)
- "Otkaži"

## Upload flow

### 1. Drag/drop ili klik file picker

```typescript
<input
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/*"
  onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
/>
```

### 2. Client-side compression

Svaki fajl prolazi kroz `browser-image-compression`:

```typescript
import imageCompression from "browser-image-compression";

const compressed = await imageCompression(file, {
  maxSizeMB: 0.3,           // 300KB
  maxWidthOrHeight: 1600,   // 1600px max dimension
  useWebWorker: true,
  fileType: "image/webp",   // Try to output WebP
});
```

**Razlog:** Smanji size prije slanja na server. Browser compress je brži od server-a.

### 3. Chunked upload (jedna po jedna)

```typescript
for (let i = 0; i < previews.length; i++) {
  setUploadProgress({ current: i + 1, total: previews.length });
  const fd = new FormData();
  fd.set("category", activeCategory);
  fd.set("file", previews[i].file);
  await uploadSingleGalleryImage(fd);
}
```

**Razlog:** Next.js server action body limit je 10MB. 20 slika × ~300KB = ~6MB — ne stane. Šaljemo jednu po jednu.

### 4. Progress overlay

Tokom upload-a: fullscreen overlay (`createPortal` u `document.body`):

```
┌──────────────────┐
│   ⟳              │
│                  │
│   4 / 20         │
│   ███████░░░     │  ← progress bar
│                  │
│  UČITAVANJE      │
│  SLIKA...        │
│                  │
│  Molimo ne       │
│  zatvarajte      │
│  stranicu        │
└──────────────────┘
```

Background: `backdrop-blur-md bg-dark/40` — Una ne može slučajno zatvoriti tab.

### 5. Per-image server validation

**Fajl:** `src/app/admin/(protected)/galerija/actions.ts`

```typescript
export async function uploadSingleGalleryImage(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file") as File;
  if (file.size > MAX_FILE_SIZE) // 5MB
    return { ok: false, error: "Slika prelazi 5 MB" };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Sharp validation
  const meta = await sharp(buffer).metadata();
  if (!ALLOWED_FORMATS.includes(meta.format))
    return { ok: false, error: "Neispravan format" };
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) // 4096
    return { ok: false, error: "Dimenzije prevelike" };

  // Convert to WebP server-side (handles cases gdje browser nije uspio)
  const webpBuffer = await sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Upload u Supabase Storage
  const filename = `${category}/${Date.now()}-${random}.webp`;
  await admin.storage.from("gallery").upload(filename, webpBuffer, {
    contentType: "image/webp",
  });

  // Insert u DB
  const { data } = await admin
    .from("gallery_images")
    .insert({ storage_path: filename, category, alt_text, order_index });

  return { ok: true, data: { id: data.id } };
}
```

### 6. Auto-dismiss notifikacija

Nakon batch upload-a:

```
✓ Uspješno učitano 13 slika
```

Nestaje nakon 5 sekundi (auto-dismiss).

Ako neka slika padne:

```
⚠ Učitano 11, neuspjelo 2: <razlog za zadnju>
```

## Delete flow

### Individual delete

Hover na sliku → crveno X dugme → confirm dialog → `deleteGalleryImage(id)` action:

1. SELECT `storage_path` iz DB
2. DELETE iz Storage
3. DELETE iz DB
4. Revalidate `/admin/galerija`, `/galerija`, `/`

### Batch delete

1. Toggle "Izaberi" mode
2. Click slike (visual selection indikator — rose border)
3. "Obriši (N)" → confirm → `deleteGalleryImages([id1, id2, ...])` action:

```typescript
const { data: rows } = await admin
  .from("gallery_images")
  .select("id, storage_path")
  .in("id", ids);

const paths = rows.map(r => r.storage_path);
await admin.storage.from("gallery").remove(paths);
await admin.from("gallery_images").delete().in("id", ids);
```

## Lightbox preview (admin)

Klik na sliku u normal mode → fullscreen lightbox sa istom logikom kao public:
- `createPortal` u body
- Focus trap
- Mobile swipe
- Desktop strelice

Razlika: admin lightbox NEMA opciju za delete (delete je u normal mode preko X dugmeta).

## Notifikacija auto-dismiss

```typescript
useEffect(() => {
  if (!message) return;
  const t = setTimeout(() => setMessage(null), 5000);
  return () => clearTimeout(t);
}, [message]);
```

Zelena "Uspješno..." poruka nestaje za 5 sekundi. Iste logika za error notifikacije.

## Edge case-ovi

| Situacija | Šta se dešava |
|-----------|----------------|
| Korisnik pokuša upload > 20 slika | Trim na 20, "Maksimalno 20 slika po uploadu" warning |
| Slika > 5MB | Server skip + error toast |
| Slika nije JPG/PNG/WebP | Server skip + error toast |
| Slika > 4096×4096 | Server skip + error toast |
| Upload prekinut | Postojeće slike već u DB, ostatak fail (resume nije implementiran) |
| Klik na slike u select mode | Toggle, nije lightbox |
| Slike već postoje | Duplikati su dozvoljeni (random filename suffix) |
