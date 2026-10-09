-- Migration 014 — a nightly record of each Instagram account's numbers.
--
-- Bundle snapshots nightly but only keeps a limited window, and the CRM stores
-- nothing at all: its analytics screen reads Bundle live each time. So any
-- history older than Bundle's window is lost permanently unless we write it
-- down as it happens. This table is that record.
--
-- Keyed on (handle, day) so the recorder can be re-run, or run twice, without
-- doubling a day. Handles are stored lowercase: Instagram treats them as
-- case-insensitive and the vault stores whatever was typed.
--
-- Impressions is the number the operators call "views" — reel plays. On these
-- accounts it climbs, so a day's gain is this row minus the day before.

create table if not exists account_metrics (
  handle      text   not null,
  day         date   not null,
  impressions bigint,
  views       bigint,
  followers   integer,
  posts       integer,
  recorded_at timestamptz not null default now(),
  primary key (handle, day)
);

create index if not exists account_metrics_day_idx on account_metrics (day desc);

comment on table account_metrics is
  'One row per Instagram account per day, written by the nightly recorder on the VPS. The only long-term history of these numbers that exists.';
comment on column account_metrics.impressions is
  'Reel views. Climbs, so day-on-day difference is views gained.';

notify pgrst, 'reload schema';

-- Supabase turns row-level security ON for new tables, and the vault runs with
-- it off everywhere else (see creators, entries, secure_notes above): there is
-- no auth layer, and the publishable key is the credential. Without this the
-- recorder's writes are refused with a policy violation.
alter table account_metrics disable row level security;

notify pgrst, 'reload schema';
