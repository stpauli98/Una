-- Tighten anon INSERT policies to prevent direct API abuse.
-- Application layer already enforces these values, but defense-in-depth
-- requires the database to enforce them too.

-- appointments: anon can only insert with status='ceka' and no confirmation
DROP POLICY IF EXISTS "appointments: anon insert" ON public.appointments;
CREATE POLICY "appointments: anon insert"
  ON public.appointments
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'ceka'
    AND confirmation_sent_at IS NULL
  );

-- training_inquiries: anon can only insert with status='novi'
DROP POLICY IF EXISTS "training_inquiries: anon insert" ON public.training_inquiries;
CREATE POLICY "training_inquiries: anon insert"
  ON public.training_inquiries
  FOR INSERT
  TO anon
  WITH CHECK (status = 'novi');
