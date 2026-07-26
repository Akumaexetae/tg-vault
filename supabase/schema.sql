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
alter publication supabase_realtime add table creators;
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table activity;

-- Built-in creator for agency-level/shared logins.
insert into creators (name, color)
  values ('Agency', '#00AFF0')
  on conflict (name) do nothing;
