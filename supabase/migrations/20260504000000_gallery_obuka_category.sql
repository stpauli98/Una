-- Proširi listu dozvoljenih kategorija za galeriju sa "obuka".
-- Commit ecb3f8e dodao je "obuka" u src/lib/gallery/categories.ts ali nije
-- uključio DB migraciju — CHECK constraint je odbijao svaki upload sa
-- category='obuka' uz "Greška pri spremanju slike u bazu".

ALTER TABLE public.gallery_images
  DROP CONSTRAINT IF EXISTS gallery_images_category_check;

ALTER TABLE public.gallery_images
  ADD CONSTRAINT gallery_images_category_check
  CHECK (category = ANY (ARRAY['sminkanje', 'svadbeno', 'pedikir', 'trepavice', 'obuka']));
