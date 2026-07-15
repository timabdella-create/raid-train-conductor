-- Support Google (and other future OAuth) sign-in alongside email/password.
--
-- OAuth sign-ins never pass our custom `role` field in raw_user_meta_data, so
-- handle_new_user() can't know whether the user picked "seller" or
-- "organizer" the way the email/password registration form does. We track
-- that with `onboarded`: true when role was explicitly chosen at signup
-- (email/password flow), false when it wasn't (OAuth flow) — the app then
-- shows a one-time "choose your role" screen for onboarded = false users.

alter table public.users
  add column if not exists onboarded boolean not null default true;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role, onboarded)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'seller'),
    (new.raw_user_meta_data ->> 'role') is not null
  );

  insert into public.profiles (user_id, display_name, timezone)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'America/New_York')
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- One-time, self-service role pick for a user who signed in via OAuth.
-- Deliberately guarded by `onboarded = false` so it can never be used as a
-- general-purpose "change my role" backdoor after the first login — the
-- existing users_update RLS policy already blocks role changes on ordinary
-- table updates.
create or replace function public.complete_oauth_onboarding(p_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set role = p_role,
      onboarded = true
  where id = auth.uid()
    and onboarded = false;
end;
$$;

grant execute on function public.complete_oauth_onboarding(user_role) to authenticated;
