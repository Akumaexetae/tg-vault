-- T&G Vault — migration 009: arrows that stay attached to shapes.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table canvas_objects add column if not exists from_id uuid
  references canvas_objects(id) on delete set null;
alter table canvas_objects add column if not exists to_id uuid
  references canvas_objects(id) on delete set null;
