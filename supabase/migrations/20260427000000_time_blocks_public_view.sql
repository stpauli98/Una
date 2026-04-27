-- Sakri reason kolonu od anon role-a kroz dedicated VIEW.
-- Razlog: reason može sadržavati privatne info ("zubar", "privatno"...).
-- Anon ključ je u browser bundle-u — bilo ko može direkt query-jati REST API.
--
-- Pristup: column projection u VIEW je privatni perimetar. View koristi
-- default security_definer (vlasnik = postgres) tako da SELECT na sirovoj
-- tabeli prolazi bez RLS provjere. Anon dobija samo (start_time, end_time)
-- kroz GRANT na view; sirova tabela je nedostupna anon-u (RLS fail-closed
-- nakon DROP postojećeg public-read policy-ja).

-- 1. Drop public SELECT na sirovoj tabeli — anon više nema policy → fail-closed.
DROP POLICY IF EXISTS "time_blocks: public read" ON public.time_blocks;

-- 2. Authenticated (admin) i dalje ima pun pristup kroz postojeći policy
-- "time_blocks: authenticated full access" — netaknut.

-- 3. Public-safe view: bez reason kolone, bez id kolone (id-evi nisu potrebni
-- za anon — koristi se samo iz /api/availability sa service_role).
CREATE OR REPLACE VIEW public.time_blocks_public AS
  SELECT start_time, end_time
  FROM public.time_blocks;

-- 4. Grant SELECT na view za anon i authenticated.
-- View se izvršava kao vlasnik (postgres) → SELECT na sirovoj tabeli prolazi
-- bez RLS provjere. Privatnost je obezbijeđena samim column projection-om.
GRANT SELECT ON public.time_blocks_public TO anon;
GRANT SELECT ON public.time_blocks_public TO authenticated;

COMMENT ON VIEW public.time_blocks_public IS
  'Public-safe projection of time_blocks (skriva reason). Koristi se u /api/availability.';
