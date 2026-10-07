-- Migration 012 — who CREATED the entry, as opposed to who last touched it.
--
-- updated_by is overwritten on every edit, so it answers "who last changed
-- this", not "who made this account". The moment one founder edits the other's
-- row it stops being usable as provenance.
--
-- Backfill note: until 3 Oct 2026 the two installs were on separate databases,
-- so neither founder could have edited the other's rows. That makes updated_by
-- an accurate record of authorship for every row existing at this point, and a
-- safe source for the one-time backfill. It would NOT be safe to re-run later.

alter table entries add column if not exists created_by text;

update entries set created_by = updated_by where created_by is null;

comment on column entries.created_by is
  'Who added this entry. Set once on insert; unlike updated_by it is never rewritten.';

-- PostgREST caches the table shape and will keep rejecting the new column
-- ("could not find ... in the schema cache") until told to reload.
notify pgrst, 'reload schema';
