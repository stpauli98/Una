-- Security hardening: replace permissive RLS policies with admin-only access.
--
-- Background: the original policies granted full CRUD to any `authenticated`
-- user, not just admin. Additionally, the "tighten RLS" migration
-- (20260422_tighten_rls.sql) dropped a policy named "appointments: anon insert"
-- but the original was named "appointments: public insert" — so the permissive
-- INSERT policy was never removed.

-- ═══════════════════════════════════════════════════════════════
-- 1. Helper function: checks if the current JWT belongs to admin
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT auth.jwt() ->> 'email' = 'peranovicuna6@gmail.com' $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Drop ALL old policies (use exact names from each migration)
-- ═══════════════════════════════════════════════════════════════

-- appointments (from 20260409100100 + 20260422)
DROP POLICY IF EXISTS "appointments: public insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments: anon insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments: authenticated full access" ON public.appointments;

-- training_inquiries (from 20260409100100 + 20260422)
DROP POLICY IF EXISTS "training_inquiries: public insert" ON public.training_inquiries;
DROP POLICY IF EXISTS "training_inquiries: anon insert" ON public.training_inquiries;
DROP POLICY IF EXISTS "training_inquiries: authenticated full access" ON public.training_inquiries;

-- services
DROP POLICY IF EXISTS "services: public read active" ON public.services;
DROP POLICY IF EXISTS "services: authenticated full access" ON public.services;

-- gallery_images
DROP POLICY IF EXISTS "gallery: public read" ON public.gallery_images;
DROP POLICY IF EXISTS "gallery: authenticated full access" ON public.gallery_images;

-- blocked_dates
DROP POLICY IF EXISTS "blocked_dates: public read" ON public.blocked_dates;
DROP POLICY IF EXISTS "blocked_dates: authenticated full access" ON public.blocked_dates;

-- working_hours
DROP POLICY IF EXISTS "working_hours: public read" ON public.working_hours;
DROP POLICY IF EXISTS "working_hours: authenticated full access" ON public.working_hours;

-- time_blocks (from 20260409120000)
DROP POLICY IF EXISTS "time_blocks: public read" ON public.time_blocks;
DROP POLICY IF EXISTS "time_blocks: authenticated full access" ON public.time_blocks;

-- settings (from 20260410)
DROP POLICY IF EXISTS "settings: public read" ON public.settings;
DROP POLICY IF EXISTS "settings: authenticated full access" ON public.settings;

-- push_subscriptions (from 20260518000001)
DROP POLICY IF EXISTS "push_subscriptions: user can read own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: user can insert own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions: user can delete own" ON public.push_subscriptions;

-- storage: gallery bucket (from 20260427000001)
DROP POLICY IF EXISTS "gallery: public read" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "gallery: authenticated delete" ON storage.objects;

-- storage: services bucket (from 20260504100000)
DROP POLICY IF EXISTS "services: public read" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "services: authenticated delete" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════
-- 3. New policies: admin-only write, public read where appropriate
-- ═══════════════════════════════════════════════════════════════

-- services
CREATE POLICY "services: anon read active"
  ON public.services FOR SELECT TO anon
  USING (active = true);
CREATE POLICY "services: admin full"
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- gallery_images
CREATE POLICY "gallery_images: public read"
  ON public.gallery_images FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "gallery_images: admin write"
  ON public.gallery_images FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "gallery_images: admin update"
  ON public.gallery_images FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "gallery_images: admin delete"
  ON public.gallery_images FOR DELETE TO authenticated
  USING (public.is_admin());

-- blocked_dates
CREATE POLICY "blocked_dates: public read"
  ON public.blocked_dates FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "blocked_dates: admin full"
  ON public.blocked_dates FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- working_hours
CREATE POLICY "working_hours: public read"
  ON public.working_hours FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "working_hours: admin full"
  ON public.working_hours FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- appointments
CREATE POLICY "appointments: anon insert"
  ON public.appointments FOR INSERT TO anon
  WITH CHECK (status = 'ceka' AND confirmation_sent_at IS NULL);
CREATE POLICY "appointments: admin full"
  ON public.appointments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- training_inquiries
CREATE POLICY "training_inquiries: anon insert"
  ON public.training_inquiries FOR INSERT TO anon
  WITH CHECK (status = 'novi');
CREATE POLICY "training_inquiries: admin full"
  ON public.training_inquiries FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- settings
CREATE POLICY "settings: public read"
  ON public.settings FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "settings: admin full"
  ON public.settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- time_blocks (no anon access; time_blocks_public view handles anon reads)
CREATE POLICY "time_blocks: admin full"
  ON public.time_blocks FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- push_subscriptions
CREATE POLICY "push_subscriptions: admin full"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 4. Storage policies: admin-only write, public read
-- ═══════════════════════════════════════════════════════════════

-- gallery bucket
CREATE POLICY "gallery: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery');
CREATE POLICY "gallery: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin());
CREATE POLICY "gallery: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin())
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin());
CREATE POLICY "gallery: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin());

-- services bucket
CREATE POLICY "services: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'services');
CREATE POLICY "services: admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'services' AND public.is_admin());
CREATE POLICY "services: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'services' AND public.is_admin())
  WITH CHECK (bucket_id = 'services' AND public.is_admin());
CREATE POLICY "services: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'services' AND public.is_admin());
