-- ============================================================================
-- Raid Train Conductor — Co-conductors
-- Lets a train's owner add another organizer as a "co-conductor" who can
-- help run day-to-day operations (approve/reject applications, manage the
-- schedule and waitlist, message sellers) without owning the train. Same
-- request/accept pattern as train transfers (0012): nothing grants access
-- until the invited organizer accepts.
--
-- The key mechanism: organizes_train() — already used throughout the RLS
-- policies for train_slots, train_applications, waitlist_entries,
-- train_participants, and train_activity_log — is extended to also return
-- true for an accepted co-conductor. That single change cascades day-to-day
-- management access everywhere it's needed, with no other policy edits.
-- Ownership-only actions (raid_trains update/delete, transfers) still key
-- off owns_organizer_profile(organizer_id) alone, so co-conductors can never
-- edit train settings, publish/unpublish, delete, transfer ownership, or
-- manage other co-conductors — enforced at the database level, not just hidden
-- in the UI.
-- ============================================================================

create table public.train_co_conductors (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  invited_by uuid not null references public.organizer_profiles(id) on delete cascade,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Only one active (pending or accepted) co-conductor row per train+organizer
-- at a time — re-inviting after a decline/removal is fine, just not while
-- one is already active.
create unique index train_co_conductors_active_unique
  on public.train_co_conductors(raid_train_id, organizer_id)
  where status in ('pending', 'accepted');

create index train_co_conductors_raid_train_id_idx on public.train_co_conductors(raid_train_id);
create index train_co_conductors_organizer_id_idx on public.train_co_conductors(organizer_id);

alter table public.train_co_conductors enable row level security;

-- Anyone who already manages the train (owner or another accepted
-- co-conductor) can see the roster; an invited organizer can see their own
-- invite regardless of status so they can act on it. No insert/update/delete
-- policies for regular users — all writes go through the security-definer
-- functions below.
create policy "train_co_conductors_select_involved"
  on public.train_co_conductors for select
  using (
    public.organizes_train(raid_train_id)
    or public.owns_organizer_profile(organizer_id)
    or public.is_admin()
  );

create policy "train_co_conductors_admin_full_access"
  on public.train_co_conductors for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- organizes_train(): extended to also return true for an accepted
-- co-conductor, not just the owner. This is what actually grants day-to-day
-- access — every existing policy that already calls organizes_train()
-- (train_slots, train_applications, waitlist_entries, train_participants,
-- train_activity_log) picks this up automatically.
-- ----------------------------------------------------------------------------
create or replace function public.organizes_train(p_raid_train_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.raid_trains rt
    join public.organizer_profiles op on op.id = rt.organizer_id
    where rt.id = p_raid_train_id and op.user_id = auth.uid()
  ) or exists (
    select 1 from public.train_co_conductors tcc
    join public.organizer_profiles op on op.id = tcc.organizer_id
    where tcc.raid_train_id = p_raid_train_id
      and tcc.status = 'accepted'
      and op.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- invite_co_conductor: owner invites another organizer by their login email.
-- ----------------------------------------------------------------------------
create or replace function public.invite_co_conductor(p_raid_train_id uuid, p_to_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_organizer_id uuid;
  v_target_organizer_id uuid;
  v_id uuid;
begin
  select organizer_id into v_owner_organizer_id
  from public.raid_trains
  where id = p_raid_train_id;

  if v_owner_organizer_id is null or not public.owns_organizer_profile(v_owner_organizer_id) then
    raise exception 'Only the train owner can invite a co-conductor.';
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

-- ----------------------------------------------------------------------------
-- respond_to_co_conductor_invite: invited organizer accepts or declines.
-- ----------------------------------------------------------------------------
create or replace function public.respond_to_co_conductor_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.train_co_conductors%rowtype;
begin
  select * into v_invite from public.train_co_conductors where id = p_invite_id;

  if v_invite.id is null then
    raise exception 'Invite not found.';
  end if;
  if not public.owns_organizer_profile(v_invite.organizer_id) then
    raise exception 'This invite is not addressed to you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  update public.train_co_conductors
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invite_id;

  insert into public.train_activity_log (raid_train_id, user_id, action_type)
  values (
    v_invite.raid_train_id,
    auth.uid(),
    case when p_accept then 'co_conductor_accepted' else 'co_conductor_declined' end
  );
end;
$$;

grant execute on function public.respond_to_co_conductor_invite(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- remove_co_conductor: the train's *current* owner can remove a co-conductor,
-- or a co-conductor can remove themselves (leave). Checks the live
-- raid_trains.organizer_id rather than train_co_conductors.invited_by so
-- this keeps working correctly even if the train changes hands via a
-- transfer (0012) after the co-conductor was invited.
-- ----------------------------------------------------------------------------
create or replace function public.remove_co_conductor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.train_co_conductors%rowtype;
  v_current_owner_id uuid;
begin
  select * into v_row from public.train_co_conductors where id = p_id;

  if v_row.id is null then
    raise exception 'Co-conductor record not found.';
  end if;

  select organizer_id into v_current_owner_id from public.raid_trains where id = v_row.raid_train_id;

  if not (public.owns_organizer_profile(v_current_owner_id) or public.owns_organizer_profile(v_row.organizer_id)) then
    raise exception 'You do not have permission to remove this co-conductor.';
  end if;
  if v_row.status not in ('pending', 'accepted') then
    raise exception 'This co-conductor entry is already inactive.';
  end if;

  update public.train_co_conductors set status = 'removed', responded_at = now() where id = p_id;

  insert into public.train_activity_log (raid_train_id, user_id, action_type)
  values (v_row.raid_train_id, auth.uid(), 'co_conductor_removed');
end;
$$;

grant execute on function public.remove_co_conductor(uuid) to authenticated;
