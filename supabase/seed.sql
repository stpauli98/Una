-- Storage bucket za galeriju (local dev only).
-- Seed runs after all services are initialized, but storage schema
-- may not exist yet in some Supabase CLI versions. Guard with IF EXISTS.
-- On remote Supabase, the bucket was already created via Dashboard.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('gallery', 'gallery', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gallery bucket: public read') THEN
      CREATE POLICY "gallery bucket: public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'gallery');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gallery bucket: admin insert') THEN
      CREATE POLICY "gallery bucket: admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gallery');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gallery bucket: admin update') THEN
      CREATE POLICY "gallery bucket: admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'gallery') WITH CHECK (bucket_id = 'gallery');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gallery bucket: admin delete') THEN
      CREATE POLICY "gallery bucket: admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'gallery');
    END IF;
  END IF;
END $$;
