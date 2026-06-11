-- Dinamičke kategorije galerije (admin-managed).
-- gallery_images.category postaje FK; ON DELETE RESTRICT blokira brisanje
-- kategorije koja još ima slike.

create table if not exists public.gallery_categories (
  key text primary key,
  label text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Jedinstven label (case-insensitive) — sprečava duplikate naziva.
create unique index if not exists gallery_categories_label_lower_key
  on public.gallery_categories (lower(label));

-- Seed postojećih 5 (MORA prije FK-a inače postojeće slike krše constraint).
insert into public.gallery_categories (key, label, order_index) values
  ('sminkanje', 'Šminkanje', 1),
  ('svadbeno',  'Svadbeno',  2),
  ('pedikir',   'Pedikir',   3),
  ('trepavice', 'Trepavice', 4),
  ('obuka',     'Obuka',     5)
on conflict (key) do nothing;

-- Zamijeni CHECK constraint FK-om.
alter table public.gallery_images
  drop constraint if exists gallery_images_category_check;

alter table public.gallery_images
  add constraint gallery_images_category_fkey
  foreign key (category) references public.gallery_categories (key)
  on delete restrict on update cascade;

-- RLS: javno čitanje (za filter) + authenticated puni pristup. Admin je jedini
-- korisnik koji se može ulogovati, pa `to authenticated` = admin gate.
-- Mirror obrasca za gallery_images iz 20260422_tighten_rls.sql (NE is_admin(),
-- koja je na nemergovanoj security grani — vidi plan „Zavisnost is_admin()").
alter table public.gallery_categories enable row level security;

create policy "gallery_categories: public read"
  on public.gallery_categories for select
  using (true);

create policy "gallery_categories: authenticated full access"
  on public.gallery_categories for all
  to authenticated
  using (true)
  with check (true);
