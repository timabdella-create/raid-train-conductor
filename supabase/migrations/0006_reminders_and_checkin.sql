-- ============================================================================
-- Raid Train Conductor — Phase 5 additions
-- Reminders and check-in. Notification *creation and delivery* moves fully
-- into the TypeScript layer (lib/notifications/send.ts) so a real email can
-- go out through Resend at the same moment the row is written — Postgres
-- functions have no outbound network access here, so the SECURITY DEFINER
-- functions that used to insert a notifications row directly (from Phase 3)
-- are redefined below to drop that step; the calling Server Action now does
-- it after the RPC succeeds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reminder de-duplication: a cron route runs every few minutes and must not
-- send the same reminder twice.
-- ----------------------------------------------------------------------------
alter table public.train_participants
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_2h_sent_at timestamptz,
  add column if not exists checkin_reminder_sent_at timestamptz;

-- ----------------------------------------------------------------------------
-- submit_train_application — identical to 0004's version, minus the
-- internal `insert into notifications`. The seller-facing Server Action
-- calls sendNotification() itself right after this succeeds.
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

  return v_application;
end;
$$;

revoke all on function public.submit_train_application(uuid, text, text, jsonb) from public;
grant execute on function public.submit_train_application(uuid, text, text, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- accept_waitlist_offer — same as 0005's version, minus the (never actually
-- present, but kept consistent) notification concern: this function never
-- inserted one itself, so this redefinition is a no-op functionally and
-- exists only so the migration history stays a complete, readable record of
-- intent alongside submit_train_application's change above.
-- ----------------------------------------------------------------------------
create or replace function public.accept_waitlist_offer(p_waitlist_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_entry waitlist_entries;
  v_slot train_slots;
  v_train raid_trains;
  v_application train_applications;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'Seller profile not found.';
  end if;

  select * into v_entry from waitlist_entries where id = p_waitlist_entry_id for update;
  if v_entry.id is null or v_entry.seller_id <> v_seller_id then
    raise exception 'Waitlist entry not found.';
  end if;
  if v_entry.status <> 'offered' or v_entry.offered_slot_id is null then
    raise exception 'There is no active offer to accept.';
  end if;
  if v_entry.offer_expires_at is not null and v_entry.offer_expires_at < now() then
    raise exception 'This offer has expired.';
  end if;

  select * into v_slot from train_slots where id = v_entry.offered_slot_id for update;
  if v_slot.id is null or v_slot.seller_id <> v_seller_id then
    raise exception 'The offered slot is no longer held for you.';
  end if;

  select * into v_train from raid_trains where id = v_entry.raid_train_id;

  insert into train_applications (raid_train_id, slot_id, seller_id, status)
  values (v_train.id, v_slot.id, v_seller_id, 'approved')
  returning * into v_application;

  update train_slots
    set status = 'confirmed', application_id = v_application.id, held_until = null
    where id = v_slot.id;

  insert into train_participants (raid_train_id, seller_id, slot_id, confirmation_status)
  values (v_train.id, v_seller_id, v_slot.id, 'confirmed');

  update waitlist_entries set status = 'accepted' where id = v_entry.id;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (v_train.id, auth.uid(), 'waitlist_offer_accepted', jsonb_build_object('slot_id', v_slot.id));
end;
$$;

revoke all on function public.accept_waitlist_offer(uuid) from public;
grant execute on function public.accept_waitlist_offer(uuid) to authenticated;
