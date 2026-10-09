-- Migration 015 — the recent metrics series, one row per account.
--
-- Reading account_metrics directly would be 111 accounts x 30 days = 3 330
-- rows, and Supabase caps an unbounded select at 1 000: the Vault would get a
-- silently truncated answer and draw graphs for a third of the roster. This
-- collapses the series into one row per handle, so the payload is small and
-- the cap is never in play.
--
-- `stable` rather than `volatile`: it only reads, so PostgREST may cache it
-- within a request.

create or replace function account_metrics_recent(days integer default 30)
returns table (handle text, series jsonb)
language sql
stable
as $$
  select
    m.handle,
    jsonb_agg(
      jsonb_build_object('d', m.day, 'i', m.impressions, 'f', m.followers)
      order by m.day
    ) as series
  from account_metrics m
  where m.day >= current_date - days
  group by m.handle
$$;

comment on function account_metrics_recent is
  'Per-account daily series for the Vault sparklines. Grouped so the response stays under the row cap.';

notify pgrst, 'reload schema';
