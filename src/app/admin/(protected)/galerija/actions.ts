"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeError } from "@/lib/utils/log";
import {
  isValidGalleryCategory,
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
 * Upload a single gallery image (chunked approach — client calls once per image).
 * This avoids the 10MB body size limit that occurs when sending many files at once.
 */
export async function uploadSingleGalleryImage(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireAdmin();
    const categoryRaw = String(formData.get("category") ?? "");
    if (!isValidGalleryCategory(categoryRaw)) {
      return { ok: false, error: "Neispravna kategorija" };
    }
    const category: GalleryCategory = categoryRaw;

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

    const admin = createAdminClient();

    // Nađi max order_index
    const { data: maxRow } = await admin
      .from("gallery_images")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.order_index ?? 0) + 1;

    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
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
        alt_text: file.name.replace(/\.[^.]+$/, ""),
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

    revalidatePath("/admin/galerija");
    revalidatePath("/galerija");
    revalidatePath("/");
    return { ok: true, data: { deleted: rows.length } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
