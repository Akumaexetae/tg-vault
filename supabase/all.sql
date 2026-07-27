-- T&G Vault — complete schema, every migration in order.
--
-- Paste this whole file into the Supabase SQL editor and Run. Safe to run
-- repeatedly: every statement is guarded, so it brings any database — empty
-- or half-migrated — up to the current version.
--
-- Storage buckets still have to be created in the dashboard (Storage → New
-- bucket): "avatars" public with a 2 MB limit, "documents" private with 10 MB.
-- The SQL editor cannot always write to storage.buckets.


-- =====================================================================
-- schema.sql
-- =====================================================================

-- T&G Vault schema — run once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#00AFF0'
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  service_key text not null default 'custom',
  service_url text not null default '',
  creator_id uuid not null references creators(id) on delete cascade,
  username text not null,
  password text not null,
  totp_secret text,
  recovery text,
  custom_fields jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  who text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  entry_label text not null,
  created_at timestamptz not null default now()
);

-- Private two-person tool: RLS intentionally disabled (owner decision, no auth).
alter table creators disable row level security;
alter table entries disable row level security;
alter table activity disable row level security;

-- Realtime: both installs subscribe to live changes.
do $$
begin
  alter publication supabase_realtime add table creators;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table entries;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table activity;
exception when duplicate_object then null;
end $$;

-- Built-in creator for agency-level/shared logins.
insert into creators (name, color)
  values ('Agency', '#00AFF0')
  on conflict (name) do nothing;

-- =====================================================================
-- migration-002.sql
-- =====================================================================

-- T&G Vault — migration 002: favorites, password history, proxies, secure notes.
-- Run once in the Supabase SQL editor (safe to re-run).

alter table entries add column if not exists pinned boolean not null default false;
alter table entries add column if not exists history jsonb not null default '[]';
alter table entries add column if not exists proxy text;

create table if not exists secure_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  creator_id uuid references creators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

alter table secure_notes disable row level security;
drop policy if exists "vault_all" on secure_notes;
create policy "vault_all" on secure_notes for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table secure_notes;
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- migration-003.sql
-- =====================================================================

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

drop policy if exists "documents_all" on storage.objects;
create policy "documents_all" on storage.objects
  for all using (bucket_id = 'documents') with check (bucket_id = 'documents');

-- =====================================================================
-- migration-004.sql
-- =====================================================================

-- T&G Vault — migration 004: creator photos.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table creators add column if not exists avatar_path text;

-- Public-read bucket: these are public-facing persona photos, and signing a URL
-- per card per render would be needless work. Nothing private goes here —
-- ID scans stay in Drive (see the dossiers spec §3).

drop policy if exists "avatars_all" on storage.objects;
create policy "avatars_all" on storage.objects
  for all using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

-- =====================================================================
-- migration-005.sql
-- =====================================================================

-- T&G Vault — migration 005: payout tracking.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- When a creator has actually been paid for a month. Null = still owed.
alter table creator_earnings add column if not exists paid_at timestamptz;
alter table creator_earnings add column if not exists paid_by text;
alter table creator_earnings add column if not exists paid_reference text;

-- =====================================================================
-- migration-006.sql
-- =====================================================================

-- T&G Vault — migration 006: planning board.
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists board_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  -- 'todo' | 'doing' | 'done'
  lane text not null default 'todo',
  -- Fractional index: inserting between two cards never rewrites its neighbours.
  position double precision not null default 0,
  assignee text,
  creator_id uuid references creators(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create index if not exists board_cards_lane_position on board_cards (lane, position);

alter table board_cards disable row level security;
drop policy if exists "vault_all" on board_cards;
create policy "vault_all" on board_cards for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table board_cards;
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- migration-007.sql
-- =====================================================================

-- T&G Vault — migration 007: planning canvas.
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists canvases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create table if not exists canvas_objects (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references canvases(id) on delete cascade,
  -- 'note' | 'text' | 'box' | 'arrow'
  kind text not null default 'note',
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 180,
  h double precision not null default 120,
  -- Arrows only: the far end. Everything else uses w/h.
  x2 double precision,
  y2 double precision,
  text text not null default '',
  color text not null default '#ffd97a',
  z integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create index if not exists canvas_objects_canvas on canvas_objects (canvas_id);

alter table canvases disable row level security;
alter table canvas_objects disable row level security;
drop policy if exists "vault_all" on canvases;
drop policy if exists "vault_all" on canvas_objects;
create policy "vault_all" on canvases for all using (true) with check (true);
create policy "vault_all" on canvas_objects for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table canvases;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table canvas_objects;
exception when duplicate_object then null;
end $$;
