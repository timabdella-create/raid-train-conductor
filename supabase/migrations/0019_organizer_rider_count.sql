-- Adds an organizer's own "trains ridden" count next to their "trains
-- hosted" count on the public train page — covers the common case where
-- the same person both organizes trains and rides on others' trains.
-- Security definer for the same reason as 0011: needs to work for
-- anonymous visitors, and only ever returns a count.

create or replace function public.get_organizer_rider_count(p_organizer_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(tp.id)
  from public.organizer_profiles op
  join public.seller_profiles sp on sp.user_id = op.user_id
  join public.train_participants tp
    on tp.seller_id = sp.id and tp.attendance_status = 'completed'
  where op.id = p_organizer_id;
$$;

grant execute on function public.get_organizer_rider_count(uuid) to anon, authenticated;
