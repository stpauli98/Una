import type { Metadata } from "next";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { GalleryGrid } from "@/components/public/GalleryGrid";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Galerija",
  description:
    "Portfolio radova UP Beauty & Makeup Studio — šminkanje, svadbeno, pedikir, trepavice.",
};

export const revalidate = 300;

export default async function GalerijaPage() {
  const supabase = await createClient();
  const { data: images } = await supabase
    .from("gallery_images")
    .select("id, storage_path, category, alt_text")
    .order("order_index");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const mapped = (images ?? []).map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/gallery/${img.storage_path}`,
    category: img.category,
    alt: img.alt_text ?? `UP Beauty Studio — ${img.category}`,
  }));

  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-warm px-6 py-16 md:py-24">
          <SectionHeader
            eyebrow="Portfolio"
            title="Galerija radova"
            className="mb-10"
          />
          <GalleryGrid images={mapped} />
        </section>
      </main>
      <Footer />
    </>
  );
}
