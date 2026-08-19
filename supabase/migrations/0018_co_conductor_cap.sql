-- ============================================================================
-- Raid Train Conductor — Co-conductor cap
-- Caps each train at a maximum of 4 active co-conductors (counting both
-- 'pending' invites and 'accepted' co-conductors, same set the roster UI
-- already treats as "active"). Previously invite_co_conductor() had no
-- limit at all. Enforced here in the security-definer function itself so
-- it holds regardless of what the UI does.
-- ============================================================================

create or replace function public.invite_co_conductor(p_raid_train_id uuid, p_to_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_organizer_id uuid;
  v_target_organizer_id uuid;
  v_active_count int;
  v_id uuid;
begin
  select organizer_id into v_owner_organizer_id
  from public.raid_trains
  where id = p_raid_train_id;

  if v_owner_organizer_id is null or not public.owns_organizer_profile(v_owner_organizer_id) then
    raise exception 'Only the train owner can invite a co-conductor.';
  end if;

  select count(*) into v_active_count
  from public.train_co_conductors
  where raid_train_id = p_raid_train_id
    and status in ('pending', 'accepted');

  if v_active_count >= 4 then
    raise exception 'This train already has the maximum of 4 co-conductors. Remove one before inviting another.';
  end if;

  select op.id into v_target_organizer_id
  from public.users u
  join public.organizer_profiles op on op.user_id = u.id
  where lower(u.email) = lower(trim(p_to_email));

  if v_target_organizer_id is null then
    raise exception 'No organizer account found for that email. They need an organizer account on Raid Train Conductor before you can add them as a co-conductor.';
  end if;

  if v_target_organizer_id = v_owner_organizer_id then
    raise exception 'You already organize this train.';
  end if;

  if exists (
    select 1 from public.train_co_conductors
    where raid_train_id = p_raid_train_id
      and organizer_id = v_target_organizer_id
      and status in ('pending', 'accepted')
  ) then
    raise exception 'That organizer already has a pending invite or is already a co-conductor on this train.';
  end if;

  insert into public.train_co_conductors (raid_train_id, organizer_id, invited_by, to_email, status)
  values (p_raid_train_id, v_target_organizer_id, v_owner_organizer_id, lower(trim(p_to_email)), 'pending')
  returning id into v_id;

  insert into public.train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (p_raid_train_id, auth.uid(), 'co_conductor_invited', jsonb_build_object('to_email', lower(trim(p_to_email))));

  return v_id;
end;
$$;

grant execute on function public.invite_co_conductor(uuid, text) to authenticated;
