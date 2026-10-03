-- Migration 011 — when the ACCOUNT was created (not when we saved it here).
--
-- entries.created_at is the row's own timestamp: the moment the entry was added
-- to the Vault. For warmed Instagram accounts that is meaningless — what matters
-- is how old the account itself is, which drives how hard you can push it.
-- Nullable: most existing entries will never have a known creation date.

alter table entries add column if not exists account_created_at date;

comment on column entries.account_created_at is
  'Date the account was created on its own platform. Not the vault row date (created_at).';
