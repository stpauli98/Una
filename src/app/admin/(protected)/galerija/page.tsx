import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { GalleryManager } from "@/components/admin/GalleryManager";
import {
  getCachedGalleryImages,
  getCachedGalleryCategories,
} from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Galerija — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminGalerijaPage() {
  const [images, categories] = await Promise.all([
    getCachedGalleryImages(),
    getCachedGalleryCategories(),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const mapped = images.map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/gallery/${img.storage_path}`,
    category: img.category,
    alt: img.alt_text ?? `UP Makeup — ${img.category}`,
  }));

  const countByKey = images.reduce<Record<string, number>>((acc, img) => {
    acc[img.category] = (acc[img.category] ?? 0) + 1;
    return acc;
  }, {});

  const cats = categories.map((c) => ({
    key: c.key,
    label: c.label,
    count: countByKey[c.key] ?? 0,
  }));

  return (
    <div>
      <PageHeader title="Galerija" subtitle="Upload i organizacija slika" />
      <div className="p-5 md:p-8">
        <GalleryManager items={mapped} categories={cats} />
      </div>
    </div>
  );
}
