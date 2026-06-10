# File upload — validation

Galerija upload zahtjeva višeslojnu validaciju da bi sprijecili malicious file-ove.

## Pipeline

```
Client                  Server
──────                  ──────
1. File picker          
2. Browser compress  →  3. HTTP POST
                        4. requireAdmin()
                        5. Max size check (5MB)
                        6. Sharp metadata read
                        7. Format check (JPEG/PNG/WebP)
                        8. Dimension check (≤4096)
                        9. Sharp convert to WebP
                        10. Upload to Storage
                        11. INSERT DB
```

Svaki korak može odbiti — defense in depth.

## Client-side compression (Korak 2)

`browser-image-compression`:

```typescript
const compressed = await imageCompression(file, {
  maxSizeMB: 0.3,           // ciljam 300KB
  maxWidthOrHeight: 1600,   // max dimension
  useWebWorker: true,       // ne blokira UI
  fileType: "image/webp",   // ciljam WebP
});
```

**Razlog:** Smanji size prije slanja na server. Vercel ima 10MB body limit.

**Limitacija:** Browser ne uvijek može da napravi pravi WebP (Safari ima bug). Server svejedno radi konverziju.

## Server-side validation

### Max file size

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5 MB

if (file.size > MAX_FILE_SIZE) {
  return { ok: false, error: "Slika prelazi 5 MB" };
}
```

5 MB je generous limit (compressed slika je ~300KB).

### Magic bytes check (kroz sharp)

```typescript
const buffer = Buffer.from(await file.arrayBuffer());

let meta: sharp.Metadata;
try {
  meta = await sharp(buffer).metadata();
} catch {
  return { ok: false, error: "Ne mogu obraditi sliku" };
}
```

`sharp.metadata()` čita prvih nekoliko bytes-a i detektuje format. Ovo je **mnogo sigurnije** od `file.type` (MIME) jer:
- `file.type` može biti spoofed (client kontroliše)
- Magic bytes su file content (server čita)

### Format whitelist

```typescript
const ALLOWED_FORMATS: sharp.AvailableFormatInfo["id"][] = [
  "jpeg",
  "png",
  "webp",
];

if (!meta.format || !ALLOWED_FORMATS.includes(meta.format as never)) {
  return { ok: false, error: "Neispravan format slike (dozvoljeni: JPG, PNG, WebP)" };
}
```

Sprjecava:
- SVG sa embedded JS (XSS vektor)
- HEIC, AVIF (TIFF, BMP — mogu imati exploit-e)
- PDF, ZIP — ne smiju biti tretirani kao slike

### Max dimensions

```typescript
const MAX_DIMENSION = 4096;

if (!meta.width || !meta.height || meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
  return { ok: false, error: "Dimenzije slike prelaze dozvoljeni limit" };
}
```

Sprjecava **decompression bomb** — slika sa malim file size ali ogromnim dimensions (8000×8000) koja crash-uje memory pri load-u.

### Server convert to WebP

```typescript
const webpBuffer = await sharp(buffer)
  .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 80 })
  .toBuffer();
```

Sve slike izlaze kao WebP, max 1600px. Bez obzira šta klijent pošalje.

**Bonus:** Sharp `resize().webp()` re-encode-uje sliku potpuno — strip-uje EXIF, ICC profiles, embedded ZIP-ove, etc.

### Upload na Storage

```typescript
const timestamp = Date.now();
const random = Math.random().toString(36).slice(2, 8);
const filename = `${category}/${timestamp}-${random}.webp`;

await admin.storage.from("gallery").upload(filename, webpBuffer, {
  contentType: "image/webp",
  upsert: false,
});
```

Filename ima random suffix → ne može se predict-ovati. Sprjecava deliberate overwrite.

### DB INSERT

```typescript
await admin.from("gallery_images").insert({
  storage_path: filename,
  category,
  alt_text: file.name.replace(/\.[^.]+$/, ""),  // strip extension
  order_index: nextOrder,
});
```

Filename → alt_text default. Una može mijenjati alt_text kasnije.

## Cleanup on failure

Ako DB INSERT padne nakon Storage upload, fajl curi u Storage:

```typescript
if (insertErr) {
  // Best-effort cleanup
  await admin.storage.from("gallery").remove([filename]);
  return { ok: false, error: "Greška pri spremanju slike u bazu" };
}
```

Bez ovoga, Storage bi imao orphan fajlove.

## Storage RLS

Migracija `20260427000001_storage_policies.sql`:

```sql
CREATE POLICY "gallery: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');

CREATE POLICY "gallery: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND is_admin());

-- ... admin update, delete
```

Anon ne može upload-ovati. Ne može ni overwrite-ovati.

## Test

Manual test:
- Upload SVG sa `<script>` → reject
- Upload PDF preimenovan na .jpg → reject (magic bytes show PDF)
- Upload 8000×8000 PNG → reject (dimensions)
- Upload 5.1 MB JPEG → reject (size)
- Upload 4000×4000 PNG → OK (within limits)
- Upload 200KB WebP → OK

Automated test (TBD — nije postavljen).

## Edge cases

| Situacija | Šta se desi |
|-----------|-------------|
| EXIF GPS coords | Strip-ovan kroz sharp convert |
| Embedded malware | Sharp decode failure → odbijena |
| Animated GIF | Sharp uzima samo prvi frame, output WebP statična |
| HEIC iz iPhone-a | `sharp.metadata` može fail-ovati (zavisi od libvips verzije) → "neispravan format" error |
| Corrupted JPEG | Sharp throws → "ne mogu obraditi" error |
| WebP sa alpha channel | Sharp preservira (output WebP keeps alpha) |
| Premali (1×1 pixel) | OK, ali useless |

## Performance

Sharp je C++ binding — fast. Tipično 100-300ms per slika.

Za batch upload od 20 slika, total ~2-6s server-side (paralelno sa network upload).

## Sledeće

- [../admin/galerija.md](../admin/galerija.md) — UI flow
