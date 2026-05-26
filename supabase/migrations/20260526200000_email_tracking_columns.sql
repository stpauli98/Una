-- Email tracking: kad je koji email tip poslan klijentu.
-- NULL = nije poslan (klijent bez email-a ili email orchestrator nije
-- uspješno deliverirao). Timestamp se piše NAKON uspješnog Resend API
-- call-a (best-effort, ne blokira booking flow).

ALTER TABLE public.appointments
  ADD COLUMN email_received_sent_at timestamptz NULL,
  ADD COLUMN email_confirmed_sent_at timestamptz NULL,
  ADD COLUMN email_cancelled_sent_at timestamptz NULL;

COMMENT ON COLUMN public.appointments.email_received_sent_at IS
  'Kad je "Primili smo rezervaciju" email poslan klijentu. NULL = nije poslan.';
COMMENT ON COLUMN public.appointments.email_confirmed_sent_at IS
  'Kad je "Una je potvrdila" email poslan klijentu. NULL = nije poslan.';
COMMENT ON COLUMN public.appointments.email_cancelled_sent_at IS
  'Kad je cancellation email poslan klijentu. NULL = nije poslan.';
