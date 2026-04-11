"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const VALID_CATEGORIES = ["sminkanje", "svadbeno", "pedikir", "trepavice"] as const;
type GalleryCategory = (typeof VALID_CATEGORIES)[number];

async function requireAuth() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Nije autorizovan");
}

export async function uploadGalleryImages(
  formData: FormData,
): Promise<ActionResult<{ uploaded: number }>> {
  try {
    await requireAuth();
    const category = String(formData.get("category") ?? "") as GalleryCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      return { ok: false, error: "Neispravna kategorija" };
    }

    const files = formData.getAll("files") as File[];
    const realFiles = files.filter(
      (f): f is File => f instanceof File && f.size > 0,
    );
    if (realFiles.length === 0) {
      return { ok: false, error: "Nije izabrana nijedna slika" };
    }

    // Koristimo admin klijenta za upload i DB insert (service role)
    const admin = createAdminClient();

    // Nađi max order_index da novi idu na kraj
    const { data: maxRow } = await admin
      .from("gallery_images")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextOrder = (maxRow?.order_index ?? 0) + 1;

    let uploaded = 0;
    for (const file of realFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const filename = `${category}/${timestamp}-${random}.webp`;

      const { error: uploadErr } = await admin.storage
        .from("gallery")
        .upload(filename, buffer, {
          contentType: "image/webp",
          upsert: false,
        });
      if (uploadErr) {
        console.error("upload failed:", uploadErr);
        continue;
      }

      const { error: insertErr } = await admin.from("gallery_images").insert({
        storage_path: filename,
        category,
        alt_text: file.name.replace(/\.[^.]+$/, ""),
        order_index: nextOrder,
      });
      if (insertErr) {
        console.error("insert failed:", insertErr);
        // pokušaj ukloniti upload-ovani fajl da ne curimo storage
        await admin.storage.from("gallery").remove([filename]);
        continue;
      }

      nextOrder += 1;
      uploaded += 1;
    }

    revalidatePath("/admin/galerija");
    revalidatePath("/galerija");
    revalidatePath("/");

    if (uploaded === 0) {
      return { ok: false, error: "Nije uspjelo slanje ni jedne slike" };
    }
    return { ok: true, data: { uploaded } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteGalleryImage(id: number): Promise<ActionResult> {
  try {
    await requireAuth();
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
    await requireAuth();
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
