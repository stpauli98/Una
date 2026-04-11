-- Prevent overlapping active appointments at the database level.
-- This is a hard guarantee against race conditions (TOCTOU) that
-- the application-level race guard in createAppointment cannot fully cover.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('ceka', 'potvrdjen'));
