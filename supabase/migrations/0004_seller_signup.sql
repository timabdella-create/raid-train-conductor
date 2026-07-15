-- ============================================================================
-- Raid Train Conductor — Phase 3 additions
-- Seller-facing signup: temporary slot holds (race-safe), application
-- submission, waitlist joining, and self-service cancellation. All of the
-- mutating logic lives in SECURITY DEFINER functions rather than direct
-- table writes, because sellers have no UPDATE grant on train_slots (only
-- organizers do, per 0002's RLS policies) — these functions are the one
-- narrow, validated doorway through that wall.
-- ============================================================================

alter table public.train_applications
  add column if not exists custom_answers jsonb not null default '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- hold_train_slot — atomically reserves an open slot for the calling seller
-- for a short window while they fill out the application form. The WHERE
-- clause on the UPDATE is what makes this race-safe: Postgres serializes
-- concurrent updates to the same row, so at most one of two simultaneous
-- callers can flip status from 'open' to 'held'. The loser gets zero rows
-- back and a clear "no longer available" error instead of a silent
-- double-booking.
-- ----------------------------------------------------------------------------
create or replace function public.hold_train_slot(p_slot_id uuid, p_hold_minutes int default 10)
returns public.train_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_train_id uuid;
  v_train_status train_status;
  v_slot train_slots;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'You need a seller profile before claiming a slot.';
  end if;

  select raid_train_id into v_train_id from train_slots where id = p_slot_id;
  if v_train_id is null then
    raise exception 'Slot not found.';
  end if;

  select status into v_train_status from raid_trains where id = v_train_id;
  if v_train_status <> 'published' then
    raise exception 'This train is not accepting sellers right now.';
  end if;

  -- A seller can only hold one slot at a time per train — release any other
  -- stale hold of theirs in this train before taking a new one.
  update train_slots
    set status = 'open', seller_id = null, held_until = null
    where raid_train_id = v_train_id and seller_id = v_seller_id and status = 'held';

  update train_slots
    set status = 'held', seller_id = v_seller_id, held_until = now() + (p_hold_minutes || ' minutes')::interval
    where id = p_slot_id
      and (status = 'open' or (status = 'held' and held_until < now()))
    returning * into v_slot;

  if v_slot.id is null then
    raise exception 'That slot was just taken — pick another one.';
  end if;

  return v_slot;
end;
$$;

revoke all on function public.hold_train_slot(uuid, int) from public;
grant execute on function public.hold_train_slot(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- release_train_slot — lets a seller give up a hold before submitting
-- (e.g. they picked the wrong slot).
-- ----------------------------------------------------------------------------
create or replace function public.release_train_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    return;
  end if;

  update train_slots
    set status = 'open', seller_id = null, held_until = null
    where id = p_slot_id and seller_id = v_seller_id and status = 'held';
end;
$$;

revoke all on function public.release_train_slot(uuid) from public;
grant execute on function public.release_train_slot(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- release_expired_holds_for_train — lazy cleanup, called whenever a train's
-- slot list is fetched for display so expired holds don't visually block
-- other sellers. No auth check needed: it only ever reverts already-expired
-- holds back to 'open', which can't leak or damage anything.
-- ----------------------------------------------------------------------------
create or replace function public.release_expired_holds_for_train(p_train_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update train_slots
    set status = 'open', seller_id = null, held_until = null
    where raid_train_id = p_train_id and status = 'held' and held_until < now();
$$;

revoke all on function public.release_expired_holds_for_train(uuid) from public;
grant execute on function public.release_expired_holds_for_train(uuid) to authenticated, anon;

-- ----------------------------------------------------------------------------
-- submit_train_application — finalizes a held slot into either an instant
-- confirmation (open signup) or a pending application (approval required).
-- Locks the slot row for the duration of the check to close the same race
-- window a naive check-then-write would leave open.
-- ----------------------------------------------------------------------------
create or replace function public.submit_train_application(
  p_slot_id uuid,
  p_seller_notes text default null,
  p_show_url text default null,
  p_custom_answers jsonb default '[]'::jsonb
)
returns public.train_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_train raid_trains;
  v_slot train_slots;
  v_status application_status;
  v_application train_applications;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'You need a seller profile before applying.';
  end if;

  select * into v_slot from train_slots where id = p_slot_id for update;
  if v_slot.id is null then
    raise exception 'Slot not found.';
  end if;
  if v_slot.seller_id is distinct from v_seller_id or v_slot.status <> 'held' or v_slot.held_until < now() then
    raise exception 'Your hold on this slot expired — please choose a slot again.';
  end if;

  select * into v_train from raid_trains where id = v_slot.raid_train_id;
  if v_train.status <> 'published' then
    raise exception 'This train is not accepting sellers right now.';
  end if;
  if v_train.signup_mode = 'invite_only' or v_train.signup_mode = 'waitlist_only' then
    raise exception 'This train does not accept direct applications.';
  end if;

  v_status := case when v_train.signup_mode = 'open' then 'approved' else 'pending' end;

  insert into train_applications
    (raid_train_id, slot_id, seller_id, status, seller_notes, show_url, custom_answers)
  values
    (v_train.id, v_slot.id, v_seller_id, v_status, nullif(p_seller_notes, ''), nullif(p_show_url, ''), coalesce(p_custom_answers, '[]'::jsonb))
  returning * into v_application;

  update train_slots
    set status = case when v_status = 'approved' then 'confirmed' else 'pending_approval' end,
        application_id = v_application.id,
        held_until = null
    where id = v_slot.id;

  if v_status = 'approved' then
    insert into train_participants (raid_train_id, seller_id, slot_id, confirmation_status, show_url)
    values (v_train.id, v_seller_id, v_slot.id, 'confirmed', nullif(p_show_url, ''));
  end if;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (v_train.id, auth.uid(), 'seller_applied', jsonb_build_object('slot_id', v_slot.id, 'result', v_status));

  insert into notifications (user_id, raid_train_id, notification_type, subject, message)
  values (
    auth.uid(),
    v_train.id,
    'signup_confirmation',
    case when v_status = 'approved' then 'You''re confirmed for ' || v_train.name else 'Application received for ' || v_train.name end,
    case
      when v_status = 'approved' then 'Your slot is confirmed. We''ll send reminders as the train gets closer.'
      else 'Your application is awaiting the organizer''s approval. We''ll let you know as soon as they respond.'
    end
  );

  return v_application;
end;
$$;

revoke all on function public.submit_train_application(uuid, text, text, jsonb) from public;
grant execute on function public.submit_train_application(uuid, text, text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- join_train_waitlist — adds the calling seller to the back of the line.
-- The unique constraint on (raid_train_id, seller_id) from 0001 blocks
-- duplicate entries; we catch that here and turn it into a friendly error.
-- ----------------------------------------------------------------------------
create or replace function public.join_train_waitlist(p_train_id uuid, p_preferred_times text default null)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_position int;
  v_entry waitlist_entries;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'You need a seller profile before joining the waitlist.';
  end if;

  if exists (select 1 from waitlist_entries where raid_train_id = p_train_id and seller_id = v_seller_id) then
    raise exception 'You are already on the waitlist for this train.';
  end if;

  select coalesce(max(position), 0) + 1 into v_position from waitlist_entries where raid_train_id = p_train_id;

  insert into waitlist_entries (raid_train_id, seller_id, preferred_times, position, status)
  values (p_train_id, v_seller_id, nullif(p_preferred_times, ''), v_position, 'waiting')
  returning * into v_entry;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (p_train_id, auth.uid(), 'seller_joined_waitlist', jsonb_build_object('position', v_position));

  return v_entry;
end;
$$;

revoke all on function public.join_train_waitlist(uuid, text) from public;
grant execute on function public.join_train_waitlist(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- cancel_train_participation — seller-initiated cancellation of a confirmed
-- slot. Frees the slot back to 'open', withdraws the application, and logs
-- a private seller_history record with how much notice they gave (organizers
-- never see this as a public score — see 0002's seller_history policies).
-- ----------------------------------------------------------------------------
create or replace function public.cancel_train_participation(p_train_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_participant train_participants;
  v_train raid_trains;
  v_notice_hours numeric;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'Seller profile not found.';
  end if;

  select * into v_participant from train_participants
    where raid_train_id = p_train_id and seller_id = v_seller_id;
  if v_participant.id is null then
    raise exception 'You are not confirmed on this train.';
  end if;

  select * into v_train from raid_trains where id = p_train_id;

  v_notice_hours := greatest(
    extract(epoch from ((v_train.event_date + v_train.start_time) at time zone v_train.timezone - now())) / 3600.0,
    0
  );

  update train_slots
    set status = 'open', seller_id = null, application_id = null, held_until = null
    where id = v_participant.slot_id;

  update train_applications
    set status = 'withdrawn'
    where raid_train_id = p_train_id and seller_id = v_seller_id;

  delete from train_participants where id = v_participant.id;

  insert into seller_history (seller_id, raid_train_id, organizer_id, attendance_status, cancellation_notice_hours)
  values (
    v_seller_id,
    p_train_id,
    v_train.organizer_id,
    case when v_notice_hours >= 24 then 'cancelled_with_notice' else 'last_minute_cancellation' end,
    v_notice_hours
  )
  on conflict (seller_id, raid_train_id) do update
    set attendance_status = excluded.attendance_status,
        cancellation_notice_hours = excluded.cancellation_notice_hours;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (p_train_id, auth.uid(), 'seller_cancelled', jsonb_build_object('seller_id', v_seller_id, 'notice_hours', v_notice_hours));
end;
$$;

revoke all on function public.cancel_train_participation(uuid) from public;
grant execute on function public.cancel_train_participation(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Extend the seller-safe applications view (defined in 0002) to include the
-- new custom_answers column, still omitting organizer_notes.
-- ----------------------------------------------------------------------------
create or replace view public.train_applications_seller_view as
  select
    id, raid_train_id, slot_id, seller_id, requested_time,
    status, seller_notes, show_url, custom_answers, created_at, updated_at
  from public.train_applications;

alter view public.train_applications_seller_view set (security_invoker = on);
