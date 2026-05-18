-- Phase B: Admin Realtime Appointments
--
-- Dodaje appointments tabelu u supabase_realtime publication tako da
-- klijent može subscribe-ovati postgres_changes eventove (INSERT, UPDATE,
-- DELETE) preko WebSocket-a.
--
-- REPLICA IDENTITY FULL — bez ovoga, UPDATE i DELETE eventovi ne sadrže
-- old row data, pa klijent ne može razlikovati šta se promijenilo.
-- Trošak: malo veći WAL volume po update-u (cijela stara row se loguje).
-- Za appointments tabelu (mala, ~stotina rows mjesečno) ovo je zanemarivo.
--
-- RLS na appointments već dozvoljava authenticated role full access,
-- pa admin klijent dobija sve eventove. Anon klijenti ne dobijaju
-- eventove (RLS filtrira realtime emit).

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
