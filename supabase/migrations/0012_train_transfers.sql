-- ============================================================================
-- Raid Train Conductor — Train ownership transfers
-- Lets an organizer hand a train off to another organizer via a request/accept
-- flow: nothing changes ownership until the recipient explicitly accepts.
-- Mirrors the existing invite/apply pattern (train_applications) rather than
-- mutating raid_trains.organizer_id directly from the client.
-- ============================================================================

create table public.train_transfers (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  from_organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  to_organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index train_transfers_raid_train_id_idx on public.train_transfers(raid_train_id);
create index train_transfers_to_organizer_id_idx on public.train_transfers(to_organizer_id);

alter table public.train_transfers enable row level security;

-- Sender can see requests they've sent, recipient can see requests addressed
-- to them, admins see everything. No insert/update/delete policies for
-- regular users — all writes go through the security-definer functions below
-- (they need to look up the recipient by login email, and public.users is
-- not selectable cross-user under RLS; see 0002_row_level_security.sql).
create policy "train_transfers_select_sender_or_recipient"
  on public.train_transfers for select
  using (
    public.owns_organizer_profile(from_organizer_id)
    or public.owns_organizer_profile(to_organizer_id)
    or public.is_admin()
  );

create policy "train_transfers_admin_full_access"
  on public.train_transfers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- initiate_train_transfer: sender starts a transfer request by the
-- recipient's login email. Fails loudly (raises) rather than silently doing
-- nothing, so the UI can surface a clear error.
-- ----------------------------------------------------------------------------
create or replace function public.initiate_train_transfer(p_raid_train_id uuid, p_to_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_organizer_id uuid;
  v_to_organizer_id uuid;
  v_transfer_id uuid;
begin
  select organizer_id into v_from_organizer_id
  from public.raid_trains
  where id = p_raid_train_id;

  if v_from_organizer_id is null or not public.owns_organizer_profile(v_from_organizer_id) then
    raise exception 'You do not organize this train.';
  end if;

  select op.id into v_to_organizer_id
  from public.users u
  join public.organizer_profiles op on op.user_id = u.id
  where lower(u.email) = lower(trim(p_to_email));

  if v_to_organizer_id is null then
    raise exception 'No organizer account found for that email. They need an organizer account on Raid Train Conductor before you can transfer a train to them.';
  end if;

  if v_to_organizer_id = v_from_organizer_id then
    raise exception 'You already organize this train.';
  end if;

  if exists (
    select 1 from public.train_transfers
    where raid_train_id = p_raid_train_id and status = 'pending'
  ) then
    raise exception 'This train already has a pending transfer request. Cancel it before starting a new one.';
  end if;

  insert into public.train_transfers (raid_train_id, from_organizer_id, to_organizer_id, to_email, status)
  values (p_raid_train_id, v_from_organizer_id, v_to_organizer_id, lower(trim(p_to_email)), 'pending')
  returning id into v_transfer_id;

  insert into public.train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (p_raid_train_id, auth.uid(), 'train_transfer_initiated', jsonb_build_object('to_email', lower(trim(p_to_email))));

  return v_transfer_id;
end;
$$;

grant execute on function public.initiate_train_transfer(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- respond_to_train_transfer: recipient accepts or declines. Accepting is the
-- only path that ever changes raid_trains.organizer_id.
-- ----------------------------------------------------------------------------
create or replace function public.respond_to_train_transfer(p_transfer_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.train_transfers%rowtype;
begin
  select * into v_transfer from public.train_transfers where id = p_transfer_id;

  if v_transfer.id is null then
    raise exception 'Transfer request not found.';
  end if;
  if not public.owns_organizer_profile(v_transfer.to_organizer_id) then
    raise exception 'This transfer request is not addressed to you.';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'This transfer request has already been resolved.';
  end if;

  if p_accept then
    update public.raid_trains set organizer_id = v_transfer.to_organizer_id where id = v_transfer.raid_train_id;
    update public.train_transfers set status = 'accepted', responded_at = now() where id = p_transfer_id;
    insert into public.train_activity_log (raid_train_id, user_id, action_type)
    values (v_transfer.raid_train_id, auth.uid(), 'train_transfer_accepted');
  else
    update public.train_transfers set status = 'declined', responded_at = now() where id = p_transfer_id;
    insert into public.train_activity_log (raid_train_id, user_id, action_type)
    values (v_transfer.raid_train_id, auth.uid(), 'train_transfer_declined');
  end if;
end;
$$;

grant execute on function public.respond_to_train_transfer(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- cancel_train_transfer: sender cancels a pending request before it's
-- accepted or declined.
-- ----------------------------------------------------------------------------
create or replace function public.cancel_train_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.train_transfers%rowtype;
begin
  select * into v_transfer from public.train_transfers where id = p_transfer_id;

  if v_transfer.id is null then
    raise exception 'Transfer request not found.';
  end if;
  if not public.owns_organizer_profile(v_transfer.from_organizer_id) then
    raise exception 'You did not send this transfer request.';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'This transfer request has already been resolved.';
  end if;

  update public.train_transfers set status = 'cancelled', responded_at = now() where id = p_transfer_id;
end;
$$;

grant execute on function public.cancel_train_transfer(uuid) to authenticated;
