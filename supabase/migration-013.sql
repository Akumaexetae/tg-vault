-- Migration 013 — free-form tags on an entry.
--
-- The pills already on a row (creator, weak, reused, old) are all DERIVED —
-- computed from the password or the creator link. There was no way to say
-- something about an account that the data cannot work out for itself, like
-- which country it presents as.
--
-- A text[] rather than a join table: these are labels, not entities, and the
-- vault is two people with a hundred accounts. Indexed so filtering by tag
-- stays quick if the roster grows.

alter table entries add column if not exists tags text[] not null default '{}';

create index if not exists entries_tags_idx on entries using gin (tags);

comment on column entries.tags is
  'Free-form labels set by hand, e.g. USA. Distinct from the derived health pills.';

notify pgrst, 'reload schema';
