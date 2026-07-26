-- T&G Vault — migration 005: payout tracking.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- When a creator has actually been paid for a month. Null = still owed.
alter table creator_earnings add column if not exists paid_at timestamptz;
alter table creator_earnings add column if not exists paid_by text;
alter table creator_earnings add column if not exists paid_reference text;
