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
