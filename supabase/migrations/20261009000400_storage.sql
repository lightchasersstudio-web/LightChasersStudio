-- Storage buckets. Both are public-read (served via the public URL / next/image);
-- only admins can upload, replace or delete. Type and size limits are enforced
-- by the bucket itself, not just the upload form.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portfolio', 'portfolio', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('brand', 'brand', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "portfolio/brand: admin insert"
on storage.objects for insert to authenticated
with check (bucket_id in ('portfolio', 'brand') and (select public.is_admin()));

create policy "portfolio/brand: admin update"
on storage.objects for update to authenticated
using (bucket_id in ('portfolio', 'brand') and (select public.is_admin()))
with check (bucket_id in ('portfolio', 'brand') and (select public.is_admin()));

create policy "portfolio/brand: admin delete"
on storage.objects for delete to authenticated
using (bucket_id in ('portfolio', 'brand') and (select public.is_admin()));
