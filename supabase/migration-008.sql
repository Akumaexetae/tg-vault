-- T&G Vault — migration 008: canvas images.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- The bucket itself may need creating in the dashboard if this insert is
-- rejected: Storage → New bucket → name "canvas-images", public, 5 MB.

insert into storage.buckets (id, name, public, file_size_limit)
  values ('canvas-images', 'canvas-images', true, 5242880)
  on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "canvas_images_all" on storage.objects;
create policy "canvas_images_all" on storage.objects
  for all using (bucket_id = 'canvas-images') with check (bucket_id = 'canvas-images');
