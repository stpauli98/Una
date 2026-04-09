-- Time blocks: sub-day blokade kada Una nije dostupna
-- (zubar, privatne obaveze, pauze). Multi-day blokade ostaju u
-- blocked_dates tabeli — time_blocks je za kraće intervale sa vremenom.

CREATE TABLE public.time_blocks (
  id bigint primary key generated always as identity,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_blocks_valid_range CHECK (end_time > start_time)
);

CREATE INDEX idx_time_blocks_start_time ON public.time_blocks(start_time);
CREATE INDEX idx_time_blocks_active_range
  ON public.time_blocks (start_time, end_time);

-- RLS
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- Public read: frontend mora da vidi da ne nudi blokirane slotove.
-- Reason može curiti ali u UI javne strane se ne prikazuje.
CREATE POLICY "time_blocks: public read"
  ON public.time_blocks
  FOR SELECT
  USING (true);

-- Admin: puni pristup kreiranje, brisanje, update
CREATE POLICY "time_blocks: authenticated full access"
  ON public.time_blocks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
