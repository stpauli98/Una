-- Add confirmation_token column to prevent IDOR on success page.
-- Instead of exposing sequential numeric IDs in the URL, we use
-- a random UUID that cannot be guessed or enumerated.

ALTER TABLE public.appointments
  ADD COLUMN confirmation_token uuid;

CREATE UNIQUE INDEX idx_appointments_confirmation_token
  ON public.appointments (confirmation_token)
  WHERE confirmation_token IS NOT NULL;
