-- UP Beauty & Makeup Studio — initial schema
-- Tables: services, appointments, blocked_dates, gallery_images,
--         training_inquiries, working_hours

-- ════════════════════════════════════════════
-- Usluge
-- ════════════════════════════════════════════
create table public.services (
  id bigint primary key generated always as identity,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  price_note text,
  duration_min int,
  duration_note text,
  category text not null
    check (category in ('sminkanje', 'pedikir', 'trepavice', 'obuka')),
  bookable boolean not null default true,
  variable_price boolean not null default false,
  order_index int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.services is
  'Katalog usluga koje studio nudi. `bookable=false` znaci da se ne prikazuje u zakazivanju (npr. obuka).';

-- ════════════════════════════════════════════
-- Termini
-- ════════════════════════════════════════════
create table public.appointments (
  id bigint primary key generated always as identity,
  service_id bigint not null references public.services(id) on delete restrict,
  client_name text not null,
  client_phone text not null,
  client_email text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'ceka'
    check (status in ('ceka', 'potvrdjen', 'otkazan', 'zavrsen')),
  notes text,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_time_range check (end_time > start_time)
);

create index idx_appointments_start_time on public.appointments (start_time);
create index idx_appointments_status on public.appointments (status);
create index idx_appointments_active_range
  on public.appointments (start_time, end_time)
  where status in ('ceka', 'potvrdjen');

-- auto-update `updated_at`
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

-- ════════════════════════════════════════════
-- Blokirani datumi
-- ════════════════════════════════════════════
create table public.blocked_dates (
  id bigint primary key generated always as identity,
  date_from date not null,
  date_to date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint chk_date_range check (date_to >= date_from)
);

create index idx_blocked_dates_range
  on public.blocked_dates (date_from, date_to);

-- ════════════════════════════════════════════
-- Galerija
-- ════════════════════════════════════════════
create table public.gallery_images (
  id bigint primary key generated always as identity,
  storage_path text not null,
  category text not null
    check (category in ('sminkanje', 'svadbeno', 'pedikir', 'trepavice')),
  alt_text text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_gallery_category_order
  on public.gallery_images (category, order_index);

-- ════════════════════════════════════════════
-- Upiti za obuku
-- ════════════════════════════════════════════
create table public.training_inquiries (
  id bigint primary key generated always as identity,
  name text not null,
  phone text not null,
  email text,
  message text,
  status text not null default 'novi'
    check (status in ('novi', 'kontaktiran', 'zavrsen')),
  created_at timestamptz not null default now()
);

create index idx_training_inquiries_status_created
  on public.training_inquiries (status, created_at desc);

-- ════════════════════════════════════════════
-- Radno vrijeme (dan u sedmici → vrijeme otvaranja/zatvaranja)
-- 0=nedjelja, 1=ponedjeljak, ..., 6=subota
-- ════════════════════════════════════════════
create table public.working_hours (
  day_of_week int primary key check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_open boolean not null default true,
  constraint chk_hours_range check (close_time > open_time)
);
