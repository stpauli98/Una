-- Row Level Security policies
-- Strategy:
--   public tables (services, gallery_images, blocked_dates, working_hours) → read-only for anon, full for authenticated
--   insert-only tables (appointments, training_inquiries) → anon can insert; only authenticated can read/update/delete

-- ════════════════════════════════════════════
-- services
-- ════════════════════════════════════════════
alter table public.services enable row level security;

create policy "services: public read active"
  on public.services
  for select
  using (active = true);

create policy "services: authenticated full access"
  on public.services
  for all
  to authenticated
  using (true)
  with check (true);

-- ════════════════════════════════════════════
-- gallery_images
-- ════════════════════════════════════════════
alter table public.gallery_images enable row level security;

create policy "gallery: public read"
  on public.gallery_images
  for select
  using (true);

create policy "gallery: authenticated full access"
  on public.gallery_images
  for all
  to authenticated
  using (true)
  with check (true);

-- ════════════════════════════════════════════
-- blocked_dates
-- ════════════════════════════════════════════
alter table public.blocked_dates enable row level security;

create policy "blocked_dates: public read"
  on public.blocked_dates
  for select
  using (true);

create policy "blocked_dates: authenticated full access"
  on public.blocked_dates
  for all
  to authenticated
  using (true)
  with check (true);

-- ════════════════════════════════════════════
-- working_hours
-- ════════════════════════════════════════════
alter table public.working_hours enable row level security;

create policy "working_hours: public read"
  on public.working_hours
  for select
  using (true);

create policy "working_hours: authenticated full access"
  on public.working_hours
  for all
  to authenticated
  using (true)
  with check (true);

-- ════════════════════════════════════════════
-- appointments — anon may INSERT, only admin reads/updates
-- ════════════════════════════════════════════
alter table public.appointments enable row level security;

create policy "appointments: public insert"
  on public.appointments
  for insert
  to anon, authenticated
  with check (true);

create policy "appointments: authenticated full access"
  on public.appointments
  for all
  to authenticated
  using (true)
  with check (true);

-- ════════════════════════════════════════════
-- training_inquiries — same pattern
-- ════════════════════════════════════════════
alter table public.training_inquiries enable row level security;

create policy "training_inquiries: public insert"
  on public.training_inquiries
  for insert
  to anon, authenticated
  with check (true);

create policy "training_inquiries: authenticated full access"
  on public.training_inquiries
  for all
  to authenticated
  using (true)
  with check (true);
