-- Public "what's happening right now" widget: live trains and upcoming
-- trains, for the homepage. Security definer for the same reason as the
-- leaderboard functions (0009) — anon needs to call these, and they only
-- return fields that are already public on each train's own page.

create or replace function public.get_current_trains(p_limit integer default 3)
returns table (
  train_id uuid,
  name text,
  slug text,
  category text,
  event_date date,
  timezone text,
  organizer_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rt.id as train_id,
    rt.name,
    rt.slug,
    rt.category,
    rt.event_date,
    rt.timezone,
    op.organizer_name
  from public.raid_trains rt
  join public.organizer_profiles op on op.id = rt.organizer_id
  where rt.visibility = 'public'
    and rt.status not in ('draft', 'cancelled', 'completed')
    and exists (
      select 1 from public.train_slots ts
      where ts.raid_train_id = rt.id
        and ts.start_datetime <= now()
        and ts.end_datetime > now()
    )
  order by rt.event_date asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_current_trains(integer) to anon, authenticated;

create or replace function public.get_upcoming_trains(p_limit integer default 3)
returns table (
  train_id uuid,
  name text,
  slug text,
  category text,
  event_date date,
  start_time time,
  timezone text,
  organizer_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rt.id as train_id,
    rt.name,
    rt.slug,
    rt.category,
    rt.event_date,
    rt.start_time,
    rt.timezone,
    op.organizer_name
  from public.raid_trains rt
  join public.organizer_profiles op on op.id = rt.organizer_id
  where rt.visibility = 'public'
    and rt.status in ('published', 'live')
    and rt.event_date >= current_date
    and not exists (
      select 1 from public.train_slots ts
      where ts.raid_train_id = rt.id
        and ts.start_datetime <= now()
        and ts.end_datetime > now()
    )
  order by rt.event_date asc, rt.start_time asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.get_upcoming_trains(integer) to anon, authenticated;
