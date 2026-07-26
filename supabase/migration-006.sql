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
