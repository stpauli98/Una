import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { getCachedGalleryImages } from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Galerija — Admin",
  robots: { index: false, follow: false },
};

// Cached preko getCachedGalleryImages — invalidate-uje se iz
// galerija/actions.ts preko updateTag.

export default async function AdminGalerijaPage() {
  const images = await getCachedGalleryImages();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const mapped = images.map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/gallery/${img.storage_path}`,
    category: img.category,
    alt: img.alt_text ?? `UP Beauty — ${img.category}`,
  }));

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
