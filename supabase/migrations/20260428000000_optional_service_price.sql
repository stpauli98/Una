-- Cijena postaje opcionalna na services tabeli.
-- Una može popuniti ili `price` (broj) ili `price_note` (tekst tipa "Od 50 KM").
-- Mora biti popunjeno barem jedno — CHECK constraint.

ALTER TABLE public.services ALTER COLUMN price DROP NOT NULL;

-- Either fiksna cijena ili tekstualna napomena mora postojati.
ALTER TABLE public.services
  ADD CONSTRAINT services_price_or_note_required
  CHECK (price IS NOT NULL OR price_note IS NOT NULL);

COMMENT ON COLUMN public.services.price IS
  'Fiksna cijena u KM. NULL kad usluga ima samo tekstualnu napomenu (price_note). Constraint: jedno od (price, price_note) mora biti setovano.';
