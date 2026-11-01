-- 0010 storage buckets: public read, admin write by permission
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('categories', 'categories', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('brands', 'brands', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('stores', 'stores', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site', 'site', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'])
on conflict (id) do nothing;

create or replace function public.storage_bucket_permission(bucket text) returns text
language sql immutable as $$
  select case bucket
    when 'products' then 'products.write'
    when 'categories' then 'categories.write'
    when 'brands' then 'brands.write'
    when 'stores' then 'stores.write'
    when 'banners' then 'marketing.write'
    when 'site' then 'settings.write'
  end;
$$;

create policy nextech_public_read on storage.objects for select
  using (bucket_id in ('products', 'categories', 'brands', 'stores', 'banners', 'site'));

create policy nextech_admin_insert on storage.objects for insert
  with check (public.storage_bucket_permission(bucket_id) is not null and public.has_admin_permission(public.storage_bucket_permission(bucket_id)));

create policy nextech_admin_update on storage.objects for update
  using (public.storage_bucket_permission(bucket_id) is not null and public.has_admin_permission(public.storage_bucket_permission(bucket_id)))
  with check (public.storage_bucket_permission(bucket_id) is not null and public.has_admin_permission(public.storage_bucket_permission(bucket_id)));

create policy nextech_admin_delete on storage.objects for delete
  using (public.storage_bucket_permission(bucket_id) is not null and public.has_admin_permission(public.storage_bucket_permission(bucket_id)));
