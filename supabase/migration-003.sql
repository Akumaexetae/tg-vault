-- T&G Vault — migration 003: creator dossiers.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- --- creators: dossier fields ---------------------------------------------
alter table creators add column if not exists kind text not null default 'creator';
alter table creators add column if not exists status text not null default 'active';
alter table creators add column if not exists legal_name text;
alter table creators add column if not exists date_of_birth date;
alter table creators add column if not exists nationality text;
alter table creators add column if not exists id_reference text;
alter table creators add column if not exists email text;
alter table creators add column if not exists phone text;
alter table creators add column if not exists telegram text;
alter table creators add column if not exists timezone text;
alter table creators add column if not exists revenue_share numeric;
alter table creators add column if not exists start_date date;
alter table creators add column if not exists contract_status text not null default 'none';
alter table creators add column if not exists notice_period_days integer;
alter table creators add column if not exists minimum_guarantee numeric;
alter table creators add column if not exists payout_method text;
alter table creators add column if not exists payout_details text;
alter table creators add column if not exists payout_currency text;
alter table creators add column if not exists payout_schedule text;
alter table creators add column if not exists of_url text;
alter table creators add column if not exists getmysocial_url text;
alter table creators add column if not exists socials jsonb not null default '[]';
alter table creators add column if not exists subscriber_count integer;
alter table creators add column if not exists subscriber_count_as_of date;
alter table creators add column if not exists drive_folder_url text;
alter table creators add column if not exists created_at timestamptz not null default now();
alter table creators add column if not exists updated_at timestamptz not null default now();
alter table creators add column if not exists updated_by text not null default 'Tyler';

-- The shared/agency row is not a person: no birthday, contract or bank account.
update creators set kind = 'agency' where name = 'Agency' and kind = 'creator';

-- --- documents -------------------------------------------------------------
create table if not exists creator_documents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete restrict,
  label text not null,
  kind text not null default 'other',
  url text,
  storage_path text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_by text not null,
  constraint document_link_or_file check (
    (url is not null and storage_path is null) or
    (url is null and storage_path is not null)
  )
);

-- --- earnings --------------------------------------------------------------
-- Gross only. The agency cut and creator payout are derived from
-- creators.revenue_share at read time, never stored.
create table if not exists creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete restrict,
  month date not null,
  gross numeric not null,
  currency text not null default 'EUR',
  notes text,
  created_at timestamptz not null default now(),
  updated_by text not null,
  unique (creator_id, month)
);

-- --- deletion safety -------------------------------------------------------
-- Was ON DELETE CASCADE: deleting a creator silently destroyed every one of
-- her credentials, TOTP secrets and password history. Now blocked; the UI
-- offers archiving instead.
alter table entries drop constraint if exists entries_creator_id_fkey;
alter table entries add constraint entries_creator_id_fkey
  foreign key (creator_id) references creators(id) on delete restrict;

-- --- access + realtime -----------------------------------------------------
alter table creator_documents disable row level security;
alter table creator_earnings disable row level security;
drop policy if exists "vault_all" on creator_documents;
drop policy if exists "vault_all" on creator_earnings;
create policy "vault_all" on creator_documents for all using (true) with check (true);
create policy "vault_all" on creator_earnings for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table creator_documents;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table creator_earnings;
exception when duplicate_object then null;
end $$;

-- --- storage ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
  values ('documents', 'documents', false, 10485760)
  on conflict (id) do update set file_size_limit = 10485760;

drop policy if exists "documents_all" on storage.objects;
create policy "documents_all" on storage.objects
  for all using (bucket_id = 'documents') with check (bucket_id = 'documents');
