import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { GalleryManager } from "@/components/admin/GalleryManager";

export const metadata: Metadata = {
  title: "Galerija — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminGalerijaPage() {
  const sb = await createClient();
  const { data: images } = await sb
    .from("gallery_images")
    .select("id, storage_path, category, alt_text")
    .order("order_index");

  const mapped = (images ?? []).map((img) => {
    const { data: publicUrl } = sb.storage
      .from("gallery")
      .getPublicUrl(img.storage_path);
    return {
      id: img.id,
      url: publicUrl.publicUrl,
      category: img.category,
      alt: img.alt_text ?? `UP Beauty — ${img.category}`,
    };
  });

  return (
    <div>
      <PageHeader
        title="Galerija"
        subtitle="Upload i organizacija slika"
      />
      <div className="p-5 md:p-8">
        <GalleryManager items={mapped} />
      </div>
    </div>
  );
}
