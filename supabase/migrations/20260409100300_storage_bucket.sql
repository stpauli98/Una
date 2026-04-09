-- Storage bucket za galeriju
-- Public read, authenticated insert/delete

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  5242880, -- 5 MB per file (after client-side sharp compression)
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "gallery bucket: public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'gallery');

create policy "gallery bucket: admin insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'gallery');

create policy "gallery bucket: admin update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'gallery')
  with check (bucket_id = 'gallery');

create policy "gallery bucket: admin delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'gallery');
