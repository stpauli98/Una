-- Sakri reason kolonu od anon role-a kroz dedicated VIEW.
-- Razlog: reason može sadržavati privatne info ("zubar", "privatno"...).
-- Anon ključ je u browser bundle-u — bilo ko može direkt query-jati REST API.

-- 1. Drop public SELECT na sirovoj tabeli
DROP POLICY IF EXISTS "time_blocks: public read" ON public.time_blocks;

-- 2. Authenticated (admin) i dalje ima pun pristup kroz postojeći policy
-- "time_blocks: authenticated full access" — netaknut.

-- 3. Public-safe view: bez reason kolone
CREATE OR REPLACE VIEW public.time_blocks_public
  WITH (security_invoker = true) AS
  SELECT id, start_time, end_time
  FROM public.time_blocks;

-- 4. Anon SELECT policy na sirovoj tabeli — eksplicitno odbij da bi RLS
-- bio konzistentan. View pristup je kontrolisan kroz GRANT.
-- (Bez ovog policy-ja, drop iz step 1 znači da nema policy → anon SELECT FAIL anyway,
-- ali eksplicitno radi auditability.)
CREATE POLICY "time_blocks: anon deny direct read"
  ON public.time_blocks
  FOR SELECT
  TO anon
  USING (false);

-- 5. Grant SELECT na view za anon i authenticated
GRANT SELECT ON public.time_blocks_public TO anon;
GRANT SELECT ON public.time_blocks_public TO authenticated;

COMMENT ON VIEW public.time_blocks_public IS
  'Public-safe projekcija time_blocks (skriva reason). Koristi se u /api/availability.';
