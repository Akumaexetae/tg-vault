-- T&G Vault — migration 004: creator photos.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table creators add column if not exists avatar_path text;

-- Public-read bucket: these are public-facing persona photos, and signing a URL
-- per card per render would be needless work. Nothing private goes here —
-- ID scans stay in Drive (see the dossiers spec §3).
insert into storage.buckets (id, name, public, file_size_limit)
  values ('avatars', 'avatars', true, 2097152)
  on conflict (id) do update set public = true, file_size_limit = 2097152;

drop policy if exists "avatars_all" on storage.objects;
create policy "avatars_all" on storage.objects
  for all using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
