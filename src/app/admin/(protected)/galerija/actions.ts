"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeError } from "@/lib/utils/log";
import {
  isValidGalleryCategory,
  slugifyCategory,
  type GalleryCategory,
} from "@/lib/gallery/categories";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 4096;
const ALLOWED_FORMATS: sharp.AvailableFormatInfo["id"][] = [
  "jpeg",
  "png",
  "webp",
];

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Kratak, opisan alt tekst za galerijsku sliku. Klijent šalje kompresovani
 * Blob čije je `file.name` često "blob" — u tom slučaju (ili prazno ime)
 * koristimo keyword-bogat fallback po kategoriji umjesto bezvrijednog "blob".
 */
const GALLERY_ALT: Record<string, string> = {
  sminkanje: "Profesionalno šminkanje — UP Makeup Gradiška",
  svadbeno: "Svadbeno šminkanje — UP Makeup Gradiška",
  pedikir: "Spa pedikir — UP Makeup Gradiška",
  trepavice: "Nadogradnja trepavica — UP Makeup Gradiška",
  obuka: "Obuka za šminkanje — UP Makeup Gradiška",
};

function deriveAltText(
  fileName: string,
  category: string,
  label?: string,
): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  if (!base || base.toLowerCase() === "blob") {
    return GALLERY_ALT[category] ?? `UP Makeup — ${label ?? category} Gradiška`;
  }
  return base;
}



/**
 * Upload a single gallery image (chunked approach — client calls once per image).
 * This avoids the 10MB body size limit that occurs when sending many files at once.
 *
 * Cache invalidation (updateTag + revalidatePath) is deliberately deferred to
 * `revalidateGallery()`, which the client calls ONCE after the batch completes.
 * Calling updateTag per-image would invalidate the cache N times for a batch upload.
 */
export async function uploadSingleGalleryImage(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const categoryRaw = String(formData.get("category") ?? "");
    const { data: cats } = await admin
      .from("gallery_categories")
      .select("key, label");
    const validKeys = (cats ?? []).map((c) => c.key);
    if (!isValidGalleryCategory(categoryRaw, validKeys)) {
      return { ok: false, error: "Neispravna kategorija" };
    }
    const category: GalleryCategory = categoryRaw;
    const catLabel = (cats ?? []).find((c) => c.key === categoryRaw)?.label;

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Nije izabrana nijedna slika" };
    }

    // Server-side validation: size, magic bytes, dimensions
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, error: "Slika prelazi 5 MB" };
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Validate format and dimensions via sharp, then convert to WebP
    let webpBuffer: Buffer;
    try {
      const meta = await sharp(rawBuffer).metadata();
      if (!meta.format || !ALLOWED_FORMATS.includes(meta.format as never)) {
        return { ok: false, error: "Neispravan format slike (dozvoljeni: JPG, PNG, WebP)" };
      }
      if (!meta.width || !meta.height || meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
        return { ok: false, error: "Dimenzije slike prelaze dozvoljeni limit" };
      }
      // Convert to WebP server-side (handles cases where client-side
      // compression didn't produce real WebP, e.g. Safari)
      webpBuffer = await sharp(rawBuffer)
        .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer();
    } catch {
      return { ok: false, error: "Ne mogu obraditi sliku" };
    }

    // Nađi max order_index
    const { data: maxRow } = await admin
      .from("gallery_images")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.order_index ?? 0) + 1;

    const timestamp = Date.now();
    const random = crypto.randomUUID().slice(0, 8);
    const filename = `${category}/${timestamp}-${random}.webp`;

    const { error: uploadErr } = await admin.storage
      .from("gallery")
      .upload(filename, webpBuffer, {
        contentType: "image/webp",
        upsert: false,
      });
    if (uploadErr) {
      console.error("upload failed:", sanitizeError(uploadErr));
      return { ok: false, error: "Greška pri slanju slike na server" };
    }

    const { data: inserted, error: insertErr } = await admin
      .from("gallery_images")
      .insert({
        storage_path: filename,
        category,
        alt_text: deriveAltText(file.name, category, catLabel),
        order_index: nextOrder,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("insert failed:", sanitizeError(insertErr));
      await admin.storage.from("gallery").remove([filename]);
      return { ok: false, error: "Greška pri spremanju slike u bazu" };
    }

    return { ok: true, data: { id: inserted.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Revalidate gallery pages — call once after all uploads complete */
export async function revalidateGallery(): Promise<void> {
  updateTag(ADMIN_CACHE_TAGS.gallery);
  revalidatePath("/admin/galerija");
  revalidatePath("/galerija");
  revalidatePath("/");
}

export async function deleteGalleryImage(id: number): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: row } = await admin
      .from("gallery_images")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (!row) return { ok: false, error: "Slika nije pronađena" };

    await admin.storage.from("gallery").remove([row.storage_path]);
    const { error } = await admin.from("gallery_images").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    updateTag(ADMIN_CACHE_TAGS.gallery);
    revalidatePath("/admin/galerija");
    revalidatePath("/galerija");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteGalleryImages(
  ids: number[],
): Promise<ActionResult<{ deleted: number }>> {
  try {
    await requireAdmin();
    if (ids.length === 0) return { ok: false, error: "Nema slika za brisanje" };

    const admin = createAdminClient();

    const { data: rows } = await admin
      .from("gallery_images")
      .select("id,storage_path")
      .in("id", ids);

    if (!rows || rows.length === 0) {
      return { ok: false, error: "Slike nisu pronađene" };
    }

    const paths = rows.map((r) => r.storage_path);
    await admin.storage.from("gallery").remove(paths);

    const { error } = await admin
      .from("gallery_images")
      .delete()
      .in("id", ids);
    if (error) return { ok: false, error: error.message };

    updateTag(ADMIN_CACHE_TAGS.gallery);
    revalidatePath("/admin/galerija");
    revalidatePath("/galerija");
    revalidatePath("/");
    return { ok: true, data: { deleted: rows.length } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Kategorije (admin-managed) ──────────────────────────────────────────────

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
    const { data: existing } = await admin
      .from("gallery_categories")
      .select("key, label, order_index");
    const rows = existing ?? [];
    if (rows.some((r) => r.label.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: "Kategorija s tim nazivom već postoji" };
    }
    const keys = new Set(rows.map((r) => r.key));
    if (keys.has(key)) {
      let n = 2;
      while (keys.has(`${key}-${n}`)) n++;
      key = `${key}-${n}`;
    }
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order_index ?? 0), 0);

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

    // Kaskadno: prvo obriši sve slike te kategorije (storage + DB), pa kategoriju.
    // FK je ON DELETE RESTRICT, pa redoslijed (slike → kategorija) je obavezan.
    const { data: imgs } = await admin
      .from("gallery_images")
      .select("storage_path")
      .eq("category", key);
    const paths = (imgs ?? []).map((r) => r.storage_path);
    if (paths.length > 0) {
      await admin.storage.from("gallery").remove(paths);
      const { error: delImgErr } = await admin
        .from("gallery_images")
        .delete()
        .eq("category", key);
      if (delImgErr) return { ok: false, error: delImgErr.message };
    }

    const { error } = await admin
      .from("gallery_categories")
      .delete()
      .eq("key", key);
    if (error) return { ok: false, error: error.message };

    revalidateCategories();
    updateTag(ADMIN_CACHE_TAGS.gallery); // slike obrisane → osvježi i galeriju
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
