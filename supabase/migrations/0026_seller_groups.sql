-- ============================================================================
-- Raid Train Conductor — Real seller groups
-- 0025 added a per-seller group_icon_url the seller uploaded individually.
-- That doesn't support "click the icon to see everyone in this group",
-- since two sellers uploading "the same" logo separately get different
-- storage URLs that never match. This replaces it with an actual shared
-- Group entity (name + one icon) that sellers join or create, so the icon
-- and membership are shared, not duplicated per-seller.
-- ============================================================================

create table public.seller_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text not null,
  created_by uuid not null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_groups_name_length check (char_length(name) between 2 and 60)
);

create trigger seller_groups_set_updated_at
  before update on public.seller_groups
  for each row execute function set_updated_at();

-- No sensitive data on this table (just a name + icon) — readable by anyone,
-- including anonymous visitors, so the group roster page and schedule-table
-- icons work without requiring a login.
alter table public.seller_groups enable row level security;

create policy "seller_groups_select_public"
  on public.seller_groups for select
  using (true);

create policy "seller_groups_insert_authenticated"
  on public.seller_groups for insert
  to authenticated
  with check (created_by = auth.uid());

-- Anyone who created a group (or an admin) can rename it / swap its icon.
create policy "seller_groups_update_owner"
  on public.seller_groups for update
  using (created_by = auth.uid() or public.is_admin());

alter table public.seller_profiles
  add column if not exists group_id uuid references public.seller_groups(id) on delete set null;

alter table public.seller_profiles
  drop column if exists group_icon_url;

-- ----------------------------------------------------------------------------
-- get_group_members: minimal public roster read.
-- seller_profiles' own RLS only lets you read a seller's row if it's your
-- own, or if that seller currently has a slot/participant row on a
-- publicly-visible train. A group roster needs to show every member
-- site-wide regardless of whether they're currently signed up anywhere, so
-- this is a narrow SECURITY DEFINER read exposing only the same public-safe
-- fields (whatnot_username, whatnot_profile_url) already shown elsewhere —
-- same pattern as the existing get_seller_completed_counts /
-- get_organizer_rider_count RPCs.
-- ----------------------------------------------------------------------------

create or replace function public.get_group_members(p_group_id uuid)
returns table (
  seller_id uuid,
  whatnot_username text,
  whatnot_profile_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select id, whatnot_username, whatnot_profile_url
  from public.seller_profiles
  where group_id = p_group_id
  order by whatnot_username asc;
$$;
