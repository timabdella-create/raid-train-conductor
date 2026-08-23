-- The `role` enum on public.users (organizer/seller/admin) drives which
-- dashboard shell a user lands on after login (see app/dashboard/page.tsx).
-- Reusing role = 'admin' to gate the new group-review queue would strip a
-- user's organizer/seller dashboard the moment they're made an admin, since
-- role is a mutually-exclusive single value. Add a separate is_admin flag so
-- "is a site admin" is orthogonal to "which dashboard do I use".

alter table public.users add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and is_admin = true
  );
$$;
