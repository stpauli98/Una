-- Seed: 9 usluga + default radno vrijeme
-- Izvor: spec `up-makeup-build-prompt.md`

insert into public.services
  (name, description, price, price_note, duration_min, duration_note, category, bookable, variable_price, order_index)
values
  ('Šminkanje', 'Profesionalno šminkanje sa trepavicama za savršen izgled.',
    70, null, 60, null, 'sminkanje', true, false, 1),
  ('Šminkanje bez trepavica', 'Prirodno šminkanje za svakodnevni glamur.',
    60, null, 60, null, 'sminkanje', true, false, 2),
  ('Terensko šminkanje', 'Šminkanje na vašoj lokaciji. Cijena je okvirna i potvrđuje se nakon razgovora.',
    150, 'od 150 KM', 60, null, 'sminkanje', true, true, 3),
  ('Estetski spa pedikir', 'Detaljan estetski tretman stopala sa spa njegom.',
    60, null, 120, null, 'pedikir', true, false, 4),
  ('Spa pedikir', 'Klasičan spa pedikir za njegovane noge.',
    40, null, 60, null, 'pedikir', true, false, 5),
  ('Trajni lak', 'Postavljanje trajnog laka na nokte na nogama.',
    40, null, 60, null, 'pedikir', true, false, 6),
  ('Yelly spa pedikir', 'Yelly spa pedikir — najluksuzniji tretman za stopala.',
    70, null, 120, null, 'pedikir', true, false, 7),
  ('Trepavice 1:1', 'Pažljivo nadograđivanje trepavica jedna po jedna.',
    60, null, 180, null, 'trepavice', true, false, 8),
  ('Obuka za šminkanje', 'Intenzivna obuka za šminkanje u trajanju od 5 dana.',
    800, null, null, '5 dana', 'obuka', false, false, 9);

-- Radno vrijeme (ijekavica latinica)
-- 0=nedjelja, 1=ponedjeljak, ..., 6=subota
insert into public.working_hours (day_of_week, open_time, close_time, is_open)
values
  (0, '05:00', '21:00', true), -- nedjelja
  (1, '17:00', '21:00', true), -- ponedjeljak
  (2, '17:00', '21:00', true), -- utorak
  (3, '17:00', '21:00', true), -- srijeda
  (4, '17:00', '21:00', true), -- četvrtak
  (5, '17:00', '21:00', true), -- petak
  (6, '05:00', '21:00', true); -- subota
