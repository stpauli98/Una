"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";

import { revalidatePath, revalidateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
import { serviceSchema, type ServiceInput } from "@/lib/services/schema";
import sharp from "sharp";
import { sanitizeError } from "@/lib/utils/log";

type ActionResult = { ok: true } | { ok: false; error: string };


function parseFormData(fd: FormData): ServiceInput {
  const durationStr = String(fd.get("duration_min") ?? "");
  const duration = durationStr === "" ? null : Number(durationStr);
  const priceStr = String(fd.get("price") ?? "");
  const price = priceStr === "" ? null : Number(priceStr);
  return serviceSchema.parse({
    name: String(fd.get("name") ?? ""),
    description: String(fd.get("description") ?? "") || null,
    price,
    price_note: String(fd.get("price_note") ?? "") || null,
    duration_min: duration,
    duration_note: String(fd.get("duration_note") ?? "") || null,
    category: String(fd.get("category") ?? "sminkanje") as ServiceInput["category"],
    bookable: fd.get("bookable") === "on",
    variable_price: fd.get("variable_price") === "on",
    active: fd.get("active") === "on",
  });
}

const SERVICE_IMG_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const SERVICE_IMG_MAX_DIMENSION = 4096;
const SERVICE_IMG_ALLOWED: sharp.AvailableFormatInfo["id"][] = [
  "jpeg",
  "png",
  "webp",
];

/**
 * Validira i konvertuje upload-ovanu sliku u WebP buffer (1200px max, q=85).
 * Vraća { ok: true, buffer } ili { ok: false, error }.
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

    revalidateTag(ADMIN_CACHE_TAGS.services, "max");
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

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
    if (!existing) return { ok: false, error: "Usluga nije pronađena" };
    const oldPath = existing.image_path;

    // Update svih tekst polja (BEZ image_path — to mijenjamo posebno).
    const { error } = await sb.from("services").update(parsed).eq("id", id);
    if (error) return { ok: false, error: error.message };

    // `removeImage` ima prednost nad novim `image` File-om — defensive: ako bi obje
    // stigle iz forme (forma to sprečava state machine-om), novi file se ignoriše.
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

    revalidateTag(ADMIN_CACHE_TAGS.services, "max");
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function toggleServiceActive(
  id: number,
  active: boolean,
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("services")
      .update({ active })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateTag(ADMIN_CACHE_TAGS.services, "max");
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reorderService(
  id: number,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const { data: current } = await sb
      .from("services")
      .select("id,order_index")
      .eq("id", id)
      .single();
    if (!current) return { ok: false, error: "Usluga nije pronađena" };

    const { data: neighbor } = await sb
      .from("services")
      .select("id,order_index")
      .order("order_index", { ascending: direction === "down" })
      [direction === "up" ? "lt" : "gt"]("order_index", current.order_index)
      .limit(1)
      .maybeSingle();

    if (!neighbor) return { ok: true };

    await sb
      .from("services")
      .update({ order_index: neighbor.order_index })
      .eq("id", current.id);
    await sb
      .from("services")
      .update({ order_index: current.order_index })
      .eq("id", neighbor.id);

    revalidateTag(ADMIN_CACHE_TAGS.services, "max");
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteService(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();

    // Pročitaj image_path da bismo brisali sliku iz storage-a (ako postoji).
    const { data: existing } = await sb
      .from("services")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Usluga nije pronađena" };

    // Pokušaj DELETE PRVO (FK constraint će je odbiti ako ima appointments).
    // Ako je DB delete uspio, TEK ONDA briši storage — orphan slika nakon
    // FK fail-a bi bila gora od orphan slike koja se ipak desi (rare).
    const { error: delErr } = await sb.from("services").delete().eq("id", id);
    if (delErr) {
      // Postgres FK violation — usluga je vezana za appointments.
      if (delErr.code === "23503") {
        return {
          ok: false,
          error:
            "Ne mogu ukloniti uslugu jer ima termina koji je koriste. Možete je deaktivirati umjesto toga.",
        };
      }
      return { ok: false, error: delErr.message };
    }

    // DB delete uspio — počisti sliku iz storage-a (best-effort, log on fail).
    if (existing.image_path) {
      const { error: rmErr } = await sb.storage
        .from("services")
        .remove([existing.image_path]);
      if (rmErr) console.error("services image cleanup failed:", sanitizeError(rmErr));
    }

    revalidateTag(ADMIN_CACHE_TAGS.services, "max");
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
