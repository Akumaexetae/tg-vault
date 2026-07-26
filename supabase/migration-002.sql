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

alter publication supabase_realtime add table secure_notes;
