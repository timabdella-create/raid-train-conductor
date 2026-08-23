-- ============================================================================
-- Raid Train Conductor — Group admins, train-group tagging, and moderation
-- status for seller_groups.
--
-- 1. seller_groups gets a status ('pending' | 'approved' | 'rejected').
--    Per product decision: a new group is fully usable the moment it's
--    created (joinable, icon shows, taggable on trains) — status is only a
--    review queue for admins, and 'rejected' is the one status that
--    actually hides a group everywhere. 'pending' and 'approved' behave
--    identically.
-- 2. seller_group_admins — mirrors train_co_conductors (0014) exactly:
--    invite-by-email, must be accepted before it grants anything. The
--    group's creator (seller_groups.created_by) is always an implicit
--    admin and never needs a row here.
-- 3. raid_trains.group_id — lets an organizer tag their train as run by a
--    group, but only if they're an admin of that group. Enforced in the
--    raid_trains RLS insert/update policies, not just the UI.
-- ============================================================================

create type group_status as enum ('pending', 'approved', 'rejected');

alter table public.seller_groups
  add column if not exists status group_status not null default 'pending';

create table public.seller_group_admins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.seller_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index seller_group_admins_active_unique
  on public.seller_group_admins(group_id, user_id)
  where status in ('pending', 'accepted');

create index seller_group_admins_group_id_idx on public.seller_group_admins(group_id);
create index seller_group_admins_user_id_idx on public.seller_group_admins(user_id);

alter table public.seller_group_admins enable row level security;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.seller_groups where id = p_group_id and created_by = auth.uid()
  ) or exists (
    select 1 from public.seller_group_admins
    where group_id = p_group_id and user_id = auth.uid() and status = 'accepted'
  );
$$ language sql stable security definer set search_path = public;

create policy "seller_group_admins_select_involved"
  on public.seller_group_admins for select
  using (
    public.is_group_admin(group_id)
    or user_id = auth.uid()
    or public.is_admin()
  );

create policy "seller_group_admins_admin_full_access"
  on public.seller_group_admins for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- invite_group_admin: an existing admin (creator or accepted admin) invites
-- another user by their login email.
-- ----------------------------------------------------------------------------
create or replace function public.invite_group_admin(p_group_id uuid, p_to_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid;
  v_id uuid;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Only an admin of this group can invite another admin.';
  end if;

  select id into v_target_user_id from public.users where lower(email) = lower(trim(p_to_email));

  if v_target_user_id is null then
    raise exception 'No account found for that email.';
  end if;

  if exists (
    select 1 from public.seller_groups where id = p_group_id and created_by = v_target_user_id
  ) then
    raise exception 'That person already created this group.';
  end if;

  if exists (
    select 1 from public.seller_group_admins
    where group_id = p_group_id and user_id = v_target_user_id and status in ('pending', 'accepted')
  ) then
    raise exception 'That person already has a pending invite or is already an admin of this group.';
  end if;

  insert into public.seller_group_admins (group_id, user_id, invited_by, to_email, status)
  values (p_group_id, v_target_user_id, auth.uid(), lower(trim(p_to_email)), 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.invite_group_admin(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- respond_to_group_admin_invite: invited user accepts or declines.
-- ----------------------------------------------------------------------------
create or replace function public.respond_to_group_admin_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.seller_group_admins%rowtype;
begin
  select * into v_invite from public.seller_group_admins where id = p_invite_id;

  if v_invite.id is null then
    raise exception 'Invite not found.';
  end if;
  if v_invite.user_id <> auth.uid() then
    raise exception 'This invite is not addressed to you.';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invite has already been resolved.';
  end if;

  update public.seller_group_admins
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invite_id;
end;
$$;

grant execute on function public.respond_to_group_admin_invite(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- remove_group_admin: any current admin can remove another admin (or
-- themselves, to leave); the creator can't be removed this way since they
-- have no row here.
-- ----------------------------------------------------------------------------
create or replace function public.remove_group_admin(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.seller_group_admins%rowtype;
begin
  select * into v_row from public.seller_group_admins where id = p_id;

  if v_row.id is null then
    raise exception 'Admin record not found.';
  end if;
  if not (public.is_group_admin(v_row.group_id) or v_row.user_id = auth.uid()) then
    raise exception 'You do not have permission to remove this admin.';
  end if;
  if v_row.status not in ('pending', 'accepted') then
    raise exception 'This admin entry is already inactive.';
  end if;

  update public.seller_group_admins set status = 'removed', responded_at = now() where id = p_id;
end;
$$;

grant execute on function public.remove_group_admin(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Train-group tagging
-- ----------------------------------------------------------------------------

alter table public.raid_trains
  add column if not exists group_id uuid references public.seller_groups(id) on delete set null;

drop policy if exists "raid_trains_insert_own" on public.raid_trains;
create policy "raid_trains_insert_own"
  on public.raid_trains for insert
  with check (
    public.owns_organizer_profile(organizer_id)
    and (group_id is null or public.is_group_admin(group_id))
  );

drop policy if exists "raid_trains_update_own" on public.raid_trains;
create policy "raid_trains_update_own"
  on public.raid_trains for update
  using (public.owns_organizer_profile(organizer_id) or public.is_admin())
  with check (
    (public.owns_organizer_profile(organizer_id) or public.is_admin())
    and (group_id is null or public.is_group_admin(group_id) or public.is_admin())
  );
