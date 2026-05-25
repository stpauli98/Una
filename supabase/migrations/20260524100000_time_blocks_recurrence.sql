-- Phase: Recurring time blocks
--
-- Dodaje recurrence_group_id koji povezuje sve time blocks u jednoj
-- "seriji" (npr. "svaki ponedjeljak 12-13 do kraja godine"). Kad admin
-- kreira recurring block, server generiše N pojedinačnih rowa sa istim
-- recurrence_group_id-em — postojeća availability engine logika ostaje
-- nepromijenjena (i dalje čita pojedinačne row-ove iz time_blocks).
--
-- Materijalizovani pristup (umjesto query-time expansion) je svjesna
-- odluka jer:
--   1. Una ima max ~10 recurring slotova × 52 nedjelje = 520 rowa/godinu,
--      što je trivijalan storage cost
--   2. Availability engine ne mora da razumije recurrence pravila
--   3. Sub-day modifikacije pojedinačnih okurencija su prirodno podržane
--      (samo update jedan row, ne cijela serija)
--
-- recurrence_group_id IS NULL → "jednokratni" time block (postojeći
-- behavior pre ove migracije). Stari rowovi ostaju validni.

ALTER TABLE public.time_blocks
  ADD COLUMN recurrence_group_id uuid NULL;

-- Index za delete-by-group i list-by-group queries
CREATE INDEX idx_time_blocks_recurrence_group_id
  ON public.time_blocks(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

COMMENT ON COLUMN public.time_blocks.recurrence_group_id IS
  'UUID grupa za blokove kreirane iz iste recurrence serije. NULL za jednokratne.';
