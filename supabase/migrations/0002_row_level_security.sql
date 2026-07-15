-- ============================================================================
-- Raid Train Conductor — Row Level Security
-- Enforces: organizers manage only their own trains; sellers manage only their
-- own profile/applications; the public can only see published public/unlisted
-- trains; private organizer notes and seller history are never seller/public
-- readable; admins have full access.
-- ============================================================================

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.organizer_profiles enable row level security;
alter table public.raid_trains enable row level security;
alter table public.train_slots enable row level security;
alter table public.train_applications enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.train_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.seller_history enable row level security;
alter table public.train_activity_log enable row level security;
alter table public.favorites enable row level security;

-- ----------------------------------------------------------------------------
-- Helper functions (security definer, avoid recursive RLS lookups)
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.owns_organizer_profile(p_organizer_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.organizer_profiles
    where id = p_organizer_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.owns_seller_profile(p_seller_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.seller_profiles
    where id = p_seller_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.organizes_train(p_raid_train_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.raid_trains rt
    join public.organizer_profiles op on op.id = rt.organizer_id
    where rt.id = p_raid_train_id and op.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.train_is_publicly_visible(p_raid_train_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.raid_trains
    where id = p_raid_train_id
      and status = 'published'
      and visibility in ('public', 'unlisted')
  );
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------

create policy "users_select_self_or_admin"
  on public.users for select
  using (id = auth.uid() or public.is_admin());

create policy "users_update_self"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));
  -- Note: role changes are intentionally blocked here. Role changes go through
  -- an admin-only server-side function in a later phase.

-- Inserts happen only via the handle_new_user() trigger (security definer),
-- so no direct insert policy is granted to end users.

create policy "users_admin_full_access"
  on public.users for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------

create policy "profiles_select_own"
  on public.profiles for select
  using (user_id = auth.uid() or public.is_admin());

-- Public profile fields (display name, photo, bio) are exposed indirectly via
-- seller_profiles/organizer_profiles joins on published trains — see below.
-- Direct table access stays restricted to the owner + admin.

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- SELLER_PROFILES
-- Public can read seller profiles ONLY when the seller has a slot/participant
-- row on a publicly visible train (keeps directory browsing possible without
-- exposing every seller's info to the whole internet).
-- ----------------------------------------------------------------------------

create policy "seller_profiles_select_own"
  on public.seller_profiles for select
  using (user_id = auth.uid() or public.is_admin());

create policy "seller_profiles_select_public_on_published_train"
  on public.seller_profiles for select
  using (
    exists (
      select 1 from public.train_participants tp
      where tp.seller_id = seller_profiles.id
        and public.train_is_publicly_visible(tp.raid_train_id)
    )
    or exists (
      select 1 from public.train_slots ts
      where ts.seller_id = seller_profiles.id
        and public.train_is_publicly_visible(ts.raid_train_id)
    )
  );

create policy "seller_profiles_insert_own"
  on public.seller_profiles for insert
  with check (user_id = auth.uid());

create policy "seller_profiles_update_own"
  on public.seller_profiles for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "seller_profiles_delete_own"
  on public.seller_profiles for delete
  using (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- ORGANIZER_PROFILES
-- Organizer display name / whatnot username are public on published trains;
-- contact_email stays visible only to the owner + admin (never to sellers or
-- the public directly through this table).
-- ----------------------------------------------------------------------------

create policy "organizer_profiles_select_own"
  on public.organizer_profiles for select
  using (user_id = auth.uid() or public.is_admin());

create policy "organizer_profiles_select_public_on_published_train"
  on public.organizer_profiles for select
  using (
    exists (
      select 1 from public.raid_trains rt
      where rt.organizer_id = organizer_profiles.id
        and rt.status = 'published'
        and rt.visibility in ('public', 'unlisted')
    )
  );

create policy "organizer_profiles_insert_own"
  on public.organizer_profiles for insert
  with check (user_id = auth.uid());

create policy "organizer_profiles_update_own"
  on public.organizer_profiles for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- RAID_TRAINS
-- ----------------------------------------------------------------------------

create policy "raid_trains_select_public"
  on public.raid_trains for select
  using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or public.owns_organizer_profile(organizer_id)
    or public.is_admin()
  );
  -- Private trains are only reachable through a server-side function that
  -- checks the invite_code, so they are deliberately excluded from this
  -- broad SELECT policy (private rows are only visible to their organizer).

create policy "raid_trains_insert_own"
  on public.raid_trains for insert
  with check (public.owns_organizer_profile(organizer_id));

create policy "raid_trains_update_own"
  on public.raid_trains for update
  using (public.owns_organizer_profile(organizer_id) or public.is_admin())
  with check (public.owns_organizer_profile(organizer_id) or public.is_admin());

create policy "raid_trains_delete_own"
  on public.raid_trains for delete
  using (public.owns_organizer_profile(organizer_id) or public.is_admin());

-- ----------------------------------------------------------------------------
-- TRAIN_SLOTS
-- ----------------------------------------------------------------------------

create policy "train_slots_select_public_or_organizer"
  on public.train_slots for select
  using (
    public.train_is_publicly_visible(raid_train_id)
    or public.organizes_train(raid_train_id)
    or public.is_admin()
    or (
      seller_id is not null and public.owns_seller_profile(seller_id)
    )
  );

create policy "train_slots_insert_organizer"
  on public.train_slots for insert
  with check (public.organizes_train(raid_train_id) or public.is_admin());

create policy "train_slots_update_organizer"
  on public.train_slots for update
  using (public.organizes_train(raid_train_id) or public.is_admin())
  with check (public.organizes_train(raid_train_id) or public.is_admin());
  -- Sellers never update slot rows directly. Claiming an open slot goes
  -- through a server-side function (SECURITY DEFINER) that holds the slot
  -- atomically and prevents double-claims — see supabase/migrations/0003+.

create policy "train_slots_delete_organizer"
  on public.train_slots for delete
  using (public.organizes_train(raid_train_id) or public.is_admin());

-- ----------------------------------------------------------------------------
-- TRAIN_APPLICATIONS
-- organizer_notes must stay invisible to the seller who submitted it.
-- Postgres RLS is row-level, not column-level, so we split visibility with a
-- view: sellers query train_applications_seller_view instead of the base
-- table for anything other than their own insert.
-- ----------------------------------------------------------------------------

create policy "train_applications_select_organizer_or_owner"
  on public.train_applications for select
  using (
    public.organizes_train(raid_train_id)
    or public.owns_seller_profile(seller_id)
    or public.is_admin()
  );

create policy "train_applications_insert_own"
  on public.train_applications for insert
  with check (public.owns_seller_profile(seller_id));

create policy "train_applications_update_organizer"
  on public.train_applications for update
  using (public.organizes_train(raid_train_id) or public.is_admin())
  with check (public.organizes_train(raid_train_id) or public.is_admin());

create policy "train_applications_seller_withdraw"
  on public.train_applications for update
  using (public.owns_seller_profile(seller_id))
  with check (public.owns_seller_profile(seller_id) and status = 'withdrawn');

create policy "train_applications_delete_organizer"
  on public.train_applications for delete
  using (public.organizes_train(raid_train_id) or public.is_admin());

-- Column-level privacy: revoke organizer_notes from the anon/authenticated
-- grants and expose a seller-safe view instead.
revoke select (organizer_notes) on public.train_applications from authenticated, anon;

create or replace view public.train_applications_seller_view as
  select
    id, raid_train_id, slot_id, seller_id, requested_time,
    status, seller_notes, show_url, created_at, updated_at
  from public.train_applications;

alter view public.train_applications_seller_view set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- WAITLIST_ENTRIES
-- ----------------------------------------------------------------------------

create policy "waitlist_select_organizer_or_owner"
  on public.waitlist_entries for select
  using (
    public.organizes_train(raid_train_id)
    or public.owns_seller_profile(seller_id)
    or public.is_admin()
  );

create policy "waitlist_insert_own"
  on public.waitlist_entries for insert
  with check (public.owns_seller_profile(seller_id));

create policy "waitlist_update_organizer"
  on public.waitlist_entries for update
  using (public.organizes_train(raid_train_id) or public.is_admin())
  with check (public.organizes_train(raid_train_id) or public.is_admin());

create policy "waitlist_seller_respond_to_offer"
  on public.waitlist_entries for update
  using (public.owns_seller_profile(seller_id) and status = 'offered')
  with check (public.owns_seller_profile(seller_id) and status in ('accepted', 'declined'));

create policy "waitlist_delete_organizer_or_owner"
  on public.waitlist_entries for delete
  using (
    public.organizes_train(raid_train_id)
    or public.owns_seller_profile(seller_id)
    or public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- TRAIN_PARTICIPANTS
-- organizer_notes here is private too (never exposed to the seller or public).
-- ----------------------------------------------------------------------------

create policy "train_participants_select_public_limited"
  on public.train_participants for select
  using (
    public.train_is_publicly_visible(raid_train_id)
    or public.organizes_train(raid_train_id)
    or public.owns_seller_profile(seller_id)
    or public.is_admin()
  );

create policy "train_participants_insert_organizer"
  on public.train_participants for insert
  with check (public.organizes_train(raid_train_id) or public.is_admin());

create policy "train_participants_update_organizer"
  on public.train_participants for update
  using (public.organizes_train(raid_train_id) or public.is_admin())
  with check (public.organizes_train(raid_train_id) or public.is_admin());

create policy "train_participants_seller_check_in"
  on public.train_participants for update
  using (public.owns_seller_profile(seller_id))
  with check (
    public.owns_seller_profile(seller_id)
    and check_in_status = 'checked_in'
  );

revoke select (organizer_notes) on public.train_participants from authenticated, anon;

create or replace view public.train_participants_public_view as
  select
    id, raid_train_id, seller_id, slot_id, confirmation_status,
    check_in_status, show_url, attendance_status, created_at, updated_at
  from public.train_participants;

alter view public.train_participants_public_view set (security_invoker = on);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS — private to the recipient
-- ----------------------------------------------------------------------------

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "notifications_insert_organizer_or_system"
  on public.notifications for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.raid_trains rt
      where rt.id = notifications.raid_train_id
        and public.organizes_train(rt.id)
    )
  );

create policy "notifications_update_own_read_state"
  on public.notifications for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- SELLER_HISTORY — organizer-private, never seller or public readable.
-- ----------------------------------------------------------------------------

create policy "seller_history_select_organizer_only"
  on public.seller_history for select
  using (public.owns_organizer_profile(organizer_id) or public.is_admin());

create policy "seller_history_insert_organizer_only"
  on public.seller_history for insert
  with check (public.owns_organizer_profile(organizer_id));

create policy "seller_history_update_organizer_only"
  on public.seller_history for update
  using (public.owns_organizer_profile(organizer_id) or public.is_admin())
  with check (public.owns_organizer_profile(organizer_id) or public.is_admin());

create policy "seller_history_delete_organizer_only"
  on public.seller_history for delete
  using (public.owns_organizer_profile(organizer_id) or public.is_admin());

-- ----------------------------------------------------------------------------
-- TRAIN_ACTIVITY_LOG — organizer-only audit trail
-- ----------------------------------------------------------------------------

create policy "activity_log_select_organizer"
  on public.train_activity_log for select
  using (public.organizes_train(raid_train_id) or public.is_admin());

create policy "activity_log_insert_organizer_or_system"
  on public.train_activity_log for insert
  with check (public.organizes_train(raid_train_id) or public.is_admin());

-- ----------------------------------------------------------------------------
-- FAVORITES
-- ----------------------------------------------------------------------------

create policy "favorites_select_own"
  on public.favorites for select
  using (user_id = auth.uid() or public.is_admin());

create policy "favorites_insert_own"
  on public.favorites for insert
  with check (user_id = auth.uid());

create policy "favorites_delete_own"
  on public.favorites for delete
  using (user_id = auth.uid());
