-- supabase/migrations/20260520000000_appointments_price_snapshot.sql
-- Snapshot cijene servisa pri označavanju termina kao zavrsen.
--
-- Pozadina: dashboard revenue izvještaji su koristili services.price kao
-- "cijenu termina", ali services.price je trenutna cijena. Ako Una poveća
-- cijenu sa 80 → 100 KM, svi prošli zavrsen termini retroaktivno vrijede
-- 100 KM u izvještaju. To je netačno — istorijski prihod treba da bude
-- immutable.
--
-- Rješenje: zaključaj cijenu u trenutku završetka. markCompleted action
-- snapshot-uje trenutnu services.price u price_snapshot kolonu. Revenue
-- query koristi price_snapshot umjesto services.price.

-- 1. Dodaj nullable kolonu (postojeći ne-zavrsen termini ostaju NULL)
ALTER TABLE public.appointments
  ADD COLUMN price_snapshot numeric(10, 2);

COMMENT ON COLUMN public.appointments.price_snapshot IS
  'Cijena servisa zabilježena pri označavanju termina kao zavrsen.
   NULL za termine koji još nisu završeni ili za stare zavrsen termine
   prije uvođenja snapshot-a (backfill best-effort).
   Koristi se za revenue izvještaje umjesto trenutne services.price.';

-- 2. Backfill postojećih zavrsen termina sa current services.price.
-- Nije idealno (nemamo pravu cijenu u trenutku završetka), ali bolje od
-- null-a za istorijske brojke. Sve nove zavrsen tranzicije bilježe pravu
-- cijenu kroz markCompleted action.
UPDATE public.appointments a
SET price_snapshot = s.price
FROM public.services s
WHERE a.service_id = s.id
  AND a.status = 'zavrsen'
  AND a.price_snapshot IS NULL;

-- 3. Partial index za brz revenue agregat — samo zavrsen redovi
CREATE INDEX IF NOT EXISTS idx_appointments_status_start_time
  ON public.appointments (status, start_time)
  WHERE status = 'zavrsen';
