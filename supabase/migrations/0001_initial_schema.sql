-- ============================================================================
-- Raid Train Conductor — Phase 1 schema
-- Foundation: users, profiles, organizer/seller profiles, trains, slots,
-- applications, waitlist, participants, notifications, history, activity log.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

create type user_role as enum ('organizer', 'seller', 'admin');

create type train_signup_mode as enum ('open', 'approval_required', 'invite_only', 'waitlist_only');

create type train_visibility as enum ('public', 'unlisted', 'private');

create type train_status as enum ('draft', 'published', 'live', 'completed', 'cancelled');

create type slot_status as enum (
  'open', 'held', 'pending_approval', 'confirmed', 'waitlisted',
  'checked_in', 'live', 'completed', 'cancelled', 'replaced', 'late', 'no_show', 'skipped'
);

create type application_status as enum ('pending', 'approved', 'rejected', 'waitlisted', 'withdrawn');

create type waitlist_status as enum ('waiting', 'offered', 'accepted', 'declined', 'expired', 'removed');

create type confirmation_status as enum ('unconfirmed', 'confirmed', 'declined');

create type check_in_status as enum ('not_checked_in', 'checked_in', 'missed');

create type attendance_status as enum (
  'pending', 'attended', 'completed', 'cancelled_with_notice',
  'last_minute_cancellation', 'late', 'no_show'
);

create type notification_type as enum (
  'signup_confirmation', 'application_approved', 'application_rejected',
  'added_to_waitlist', 'slot_changed', 'reminder_24h', 'reminder_2h',
  'check_in_reminder', 'you_are_next', 'cancellation_confirmation',
  'replacement_offer', 'custom'
);

create type delivery_method as enum ('email', 'sms', 'push', 'discord');

create type delivery_status as enum ('queued', 'sent', 'failed');

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- USERS
-- Mirrors auth.users (1:1). Created automatically via trigger on signup.
-- ----------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'seller',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function set_updated_at();

-- Auto-create a public.users row (and a base profile) whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'seller')
  );

  insert into public.profiles (user_id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'America/New_York')
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- PROFILES (base profile shared by all roles)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  phone text,
  profile_photo_url text,
  bio text,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- SELLER_PROFILES
-- ----------------------------------------------------------------------------

create table public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  whatnot_username text not null,
  whatnot_profile_url text not null,
  shop_logo_url text,
  seller_category text,
  sales_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatnot_profile_url_is_https check (whatnot_profile_url ~* '^https://')
);

create trigger seller_profiles_set_updated_at
  before update on public.seller_profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- ORGANIZER_PROFILES
-- ----------------------------------------------------------------------------

create table public.organizer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  organizer_name text not null,
  whatnot_username text,
  contact_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizer_profiles_set_updated_at
  before update on public.organizer_profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- RAID_TRAINS
-- ----------------------------------------------------------------------------

create table public.raid_trains (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  theme text,
  category text,
  image_url text,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/New_York',
  slot_duration_minutes integer not null check (slot_duration_minutes > 0),
  signup_mode train_signup_mode not null default 'open',
  visibility train_visibility not null default 'public',
  status train_status not null default 'draft',
  rules text,
  cancellation_policy text,
  check_in_minutes_before integer not null default 120,
  invite_code text,
  cloned_from_id uuid references public.raid_trains(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

create index raid_trains_organizer_id_idx on public.raid_trains(organizer_id);
create index raid_trains_status_visibility_idx on public.raid_trains(status, visibility);
create index raid_trains_event_date_idx on public.raid_trains(event_date);

create trigger raid_trains_set_updated_at
  before update on public.raid_trains
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- TRAIN_SLOTS
-- ----------------------------------------------------------------------------

create table public.train_slots (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  position integer not null,
  status slot_status not null default 'open',
  seller_id uuid references public.seller_profiles(id) on delete set null,
  application_id uuid,
  held_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slot_end_after_start check (end_datetime > start_datetime),
  -- One seller cannot occupy two slots in the same train.
  unique (raid_train_id, seller_id),
  unique (raid_train_id, position)
);

create index train_slots_raid_train_id_idx on public.train_slots(raid_train_id);
create index train_slots_status_idx on public.train_slots(status);

-- A given slot may only have ONE seller confirmed/live/checked_in/completed at a time.
-- (seller_id + raid_train_id uniqueness above already blocks a seller double-booking;
--  this partial unique index blocks two *different* sellers from both being marked
--  "active" on the same slot id, which the app should never do, but the DB should too.)
create unique index train_slots_single_active_seller_idx
  on public.train_slots (id)
  where status in ('confirmed', 'checked_in', 'live', 'completed');

create trigger train_slots_set_updated_at
  before update on public.train_slots
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- TRAIN_APPLICATIONS
-- ----------------------------------------------------------------------------

create table public.train_applications (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  slot_id uuid references public.train_slots(id) on delete set null,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  requested_time timestamptz,
  status application_status not null default 'pending',
  organizer_notes text,
  seller_notes text,
  show_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A seller may only have one active (pending/approved) application per train.
  unique (raid_train_id, seller_id)
);

create index train_applications_raid_train_id_idx on public.train_applications(raid_train_id);
create index train_applications_seller_id_idx on public.train_applications(seller_id);
create index train_applications_status_idx on public.train_applications(status);

create trigger train_applications_set_updated_at
  before update on public.train_applications
  for each row execute function set_updated_at();

alter table public.train_slots
  add constraint train_slots_application_id_fkey
  foreign key (application_id) references public.train_applications(id) on delete set null;

-- ----------------------------------------------------------------------------
-- WAITLIST_ENTRIES
-- ----------------------------------------------------------------------------

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  preferred_times text,
  position integer not null,
  status waitlist_status not null default 'waiting',
  offered_slot_id uuid references public.train_slots(id) on delete set null,
  offer_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (raid_train_id, seller_id)
);

create index waitlist_entries_raid_train_id_idx on public.waitlist_entries(raid_train_id);

create trigger waitlist_entries_set_updated_at
  before update on public.waitlist_entries
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- TRAIN_PARTICIPANTS (the "roster" — one row per confirmed seller in a train)
-- ----------------------------------------------------------------------------

create table public.train_participants (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  slot_id uuid references public.train_slots(id) on delete set null,
  confirmation_status confirmation_status not null default 'unconfirmed',
  check_in_status check_in_status not null default 'not_checked_in',
  checked_in_at timestamptz,
  show_url text,
  attendance_status attendance_status not null default 'pending',
  organizer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (raid_train_id, seller_id)
);

create index train_participants_raid_train_id_idx on public.train_participants(raid_train_id);
create index train_participants_seller_id_idx on public.train_participants(seller_id);

create trigger train_participants_set_updated_at
  before update on public.train_participants
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  raid_train_id uuid references public.raid_trains(id) on delete cascade,
  notification_type notification_type not null,
  subject text not null,
  message text not null,
  delivery_method delivery_method not null default 'email',
  delivery_status delivery_status not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_raid_train_id_idx on public.notifications(raid_train_id);

-- ----------------------------------------------------------------------------
-- SELLER_HISTORY (private, organizer-only records — never exposed publicly)
-- ----------------------------------------------------------------------------

create table public.seller_history (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  attendance_status attendance_status not null default 'pending',
  raid_completed boolean not null default false,
  cancellation_notice_hours numeric,
  private_notes text,
  created_at timestamptz not null default now(),
  unique (seller_id, raid_train_id)
);

create index seller_history_seller_id_idx on public.seller_history(seller_id);
create index seller_history_organizer_id_idx on public.seller_history(organizer_id);

-- ----------------------------------------------------------------------------
-- TRAIN_ACTIVITY_LOG (audit log of organizer/system actions)
-- ----------------------------------------------------------------------------

create table public.train_activity_log (
  id uuid primary key default gen_random_uuid(),
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action_type text not null,
  action_details jsonb,
  created_at timestamptz not null default now()
);

create index train_activity_log_raid_train_id_idx on public.train_activity_log(raid_train_id);

-- ----------------------------------------------------------------------------
-- FAVORITES (optional, future — included now so the type is stable)
-- ----------------------------------------------------------------------------

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  raid_train_id uuid not null references public.raid_trains(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, raid_train_id)
);
