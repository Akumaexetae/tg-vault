-- T&G Vault — migration 010: daily earnings detail.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- creator_earnings stays the canonical MONTHLY figure that payouts are based
-- on. This table holds the per-day detail that statement imports already know
-- but used to discard, so charts can show day and week resolution.
--
-- Precedence rule (enforced in lib/analytics.ts, not here): for a given
-- creator and month, if daily rows exist they are the truth for charting and
-- the monthly row is ignored. Summing both would double the revenue.

create table if not exists creator_daily (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete restrict,
  day date not null,
  gross numeric not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_by text not null,
  unique (creator_id, day)
);

create index if not exists creator_daily_day on creator_daily (day);
create index if not exists creator_daily_creator on creator_daily (creator_id);

alter table creator_daily disable row level security;
drop policy if exists "vault_all" on creator_daily;
create policy "vault_all" on creator_daily for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table creator_daily;
exception when duplicate_object then null;
end $$;
