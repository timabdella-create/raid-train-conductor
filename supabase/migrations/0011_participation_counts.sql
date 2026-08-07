-- Per-person "trains hosted" / "trains as a seller" counts, shown next to
-- names on the public train page and in the organizer's applications view.
-- Security definer for the same reason as the leaderboard/activity
-- functions (0009, 0010) — anon needs to call these, and they only ever
-- return a count, no sensitive data.

create or replace function public.get_organizer_completed_count(p_organizer_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.raid_trains
  where organizer_id = p_organizer_id
    and status = 'completed';
$$;

grant execute on function public.get_organizer_completed_count(uuid) to anon, authenticated;

-- Batched so a page with many sellers on one schedule can fetch all their
-- counts in a single round trip instead of one call per seller. Uses a
-- left join so a seller with zero completed trains still gets a row
-- (count = 0) rather than being silently omitted.
create or replace function public.get_seller_completed_counts(p_seller_ids uuid[])
returns table (
  seller_id uuid,
  completed_trains bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select ids.id as seller_id, count(tp.id) as completed_trains
  from unnest(p_seller_ids) as ids(id)
  left join public.train_participants tp
    on tp.seller_id = ids.id and tp.attendance_status = 'completed'
  group by ids.id;
$$;

grant execute on function public.get_seller_completed_counts(uuid[]) to anon, authenticated;
