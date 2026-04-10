-- Settings key-value store za konfigurisana booking pravila.
-- Seed: 4 reda sa default vrijednostima iz BOOKING_RULES.

CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (key, value) VALUES
  ('min_hours_before', '24'),
  ('advance_booking_days', '90'),
  ('cancellation_hours', '24'),
  ('break_between_min', '0');

-- RLS: public read (availability engine), authenticated write (admin)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: public read"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "settings: authenticated full access"
  ON public.settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
