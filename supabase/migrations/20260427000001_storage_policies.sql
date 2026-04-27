-- Eksplicitne storage policies za `gallery` bucket.
-- Prethodno postavljene kroz Supabase dashboard manualno — ovo ih čini
-- reproducibilnim i code-review-ovanim.
--
-- Ako lokalni dashboard već ima policies sa istim imenima, DROP IF EXISTS
-- ih briše prije rekreacije — migracija je idempotentna.

-- Bucket: idempotentno osiguraj da je public read.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('gallery', 'gallery', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop stare policies postavljene kroz dashboard (stara imena)
DROP POLICY IF EXISTS "gallery bucket: public read"   ON storage.objects;
DROP POLICY IF EXISTS "gallery bucket: admin insert"  ON storage.objects;
DROP POLICY IF EXISTS "gallery bucket: admin update"  ON storage.objects;
DROP POLICY IF EXISTS "gallery bucket: admin delete"  ON storage.objects;

-- Drop nove policies ako već postoje (idempotentnost pri ponovnom resetu)
DROP POLICY IF EXISTS "gallery: public read"           ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated insert"  ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated update"  ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated delete"  ON storage.objects;

-- Public može čitati slike (galerija je javna; URL-ovi su u src kodu).
CREATE POLICY "gallery: public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'gallery');

-- Samo authenticated (admin) može upload-ovati nove fajlove.
CREATE POLICY "gallery: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery');

-- Samo authenticated može menjati postojeće fajlove (npr. metadata update).
CREATE POLICY "gallery: authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery')
  WITH CHECK (bucket_id = 'gallery');

-- Samo authenticated može brisati slike.
CREATE POLICY "gallery: authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery');
