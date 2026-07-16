-- Top-3 leaderboards for organizers and sellers, ranked by completed trains.
--
-- Both are security definer functions so they can be called by anon (public
-- homepage) and authenticated (dashboards) alike without needing broad RLS
-- grants on organizer_profiles / seller_profiles / train_participants — they
-- only ever return the handful of columns that are already shown publicly
-- elsewhere (organizer name, seller display name/Whatnot username, a count).

create or replace function public.get_top_organizers(p_limit integer default 3)
returns table (
  organizer_id uuid,
  organizer_name text,
  completed_trains bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    op.id as organizer_id,
    op.organizer_name,
    count(rt.id) as completed_trains
  from public.organizer_profiles op
  join public.raid_trains rt on rt.organizer_id = op.id and rt.status = 'completed'
  group by op.id, op.organizer_name
  order by count(rt.id) desc, op.organizer_name asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_top_organizers(integer) to anon, authenticated;

create or replace function public.get_top_sellers(p_limit integer default 3)
returns table (
  seller_id uuid,
  display_name text,
  whatnot_username text,
  completed_trains bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sp.id as seller_id,
    p.display_name,
    sp.whatnot_username,
    count(tp.id) as completed_trains
  from public.seller_profiles sp
  join public.profiles p on p.user_id = sp.user_id
  join public.train_participants tp
    on tp.seller_id = sp.id and tp.attendance_status = 'completed'
  group by sp.id, p.display_name, sp.whatnot_username
  order by count(tp.id) desc, p.display_name asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_top_sellers(integer) to anon, authenticated;
