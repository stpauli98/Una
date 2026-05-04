-- supabase/migrations/20260504100000_service_image.sql
-- Slike za usluge — opciona slika koja se prikazuje na ServiceCard
-- na landing page-u i /usluge stranici.
--
-- Storage path konvencija: services/<id>-<random>.webp
-- Public read; insert/update/delete samo authenticated (admin).

-- 1. Kolona za putanju u storage-u (nullable — postojeće usluge ostaju bez slike).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_path text;

-- 2. Bucket za usluge (idempotentno).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('services', 'services', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage RLS policies.
DROP POLICY IF EXISTS "services: public read"           ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated insert"  ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated update"  ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated delete"  ON storage.objects;

CREATE POLICY "services: public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'services');

CREATE POLICY "services: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'services');

CREATE POLICY "services: authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'services')
  WITH CHECK (bucket_id = 'services');

CREATE POLICY "services: authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'services');
