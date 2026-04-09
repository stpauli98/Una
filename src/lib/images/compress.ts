import "server-only";
import sharp from "sharp";

/**
 * Kompresuje sliku na max 1600px širine i konvertuje u WebP (quality 82).
 * Koristi `sharp` — server-only.
 */
export async function compressToWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // poštuje EXIF orijentaciju
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}
