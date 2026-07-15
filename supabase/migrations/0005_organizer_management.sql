-- ============================================================================
-- Raid Train Conductor — Phase 4 additions
-- Organizer management: waitlist offers that a seller must accept/decline,
-- and an atomic seller-swap between two slots for the schedule manager's
-- drag-and-drop. Approve/reject/reassign/remove actions for applications and
-- the waitlist don't need new functions — organizers already have direct
-- UPDATE rights on train_slots / train_applications / waitlist_entries for
-- trains they own (see 0002's RLS), so those run as plain authenticated
-- writes from the Server Actions. These functions exist only where a
-- SELLER needs to make a change that RLS doesn't let them make directly, or
-- where multiple rows must move together atomically.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- accept_waitlist_offer — a seller accepting a slot the organizer offered
-- them. Confirms the slot, creates the application + participant rows, and
-- closes out the waitlist entry. Mirrors submit_train_application's
-- "approved" branch, but starting from an offer instead of a fresh hold.
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

-- ----------------------------------------------------------------------------
-- decline_waitlist_offer — frees the offered slot back to open immediately
-- so the organizer can offer it to the next person in line.
-- ----------------------------------------------------------------------------
create or replace function public.decline_waitlist_offer(p_waitlist_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_entry waitlist_entries;
begin
  select id into v_seller_id from seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'Seller profile not found.';
  end if;

  select * into v_entry from waitlist_entries where id = p_waitlist_entry_id for update;
  if v_entry.id is null or v_entry.seller_id <> v_seller_id then
    raise exception 'Waitlist entry not found.';
  end if;
  if v_entry.status <> 'offered' then
    raise exception 'There is no active offer to decline.';
  end if;

  if v_entry.offered_slot_id is not null then
    update train_slots
      set status = 'open', seller_id = null, held_until = null
      where id = v_entry.offered_slot_id and seller_id = v_seller_id;
  end if;

  update waitlist_entries
    set status = 'declined', offered_slot_id = null, offer_expires_at = null
    where id = v_entry.id;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (v_entry.raid_train_id, auth.uid(), 'waitlist_offer_declined', jsonb_build_object('waitlist_entry_id', v_entry.id));
end;
$$;

revoke all on function public.decline_waitlist_offer(uuid) from public;
grant execute on function public.decline_waitlist_offer(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- release_expired_waitlist_offers_for_train — lazy cleanup, same pattern as
-- release_expired_holds_for_train from 0004. Called when the organizer's
-- waitlist page loads so a seller who never responded doesn't block the
-- slot forever.
-- ----------------------------------------------------------------------------
create or replace function public.release_expired_waitlist_offers_for_train(p_train_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update train_slots
    set status = 'open', seller_id = null, held_until = null
    where raid_train_id = p_train_id
      and status = 'held'
      and seller_id in (
        select seller_id from waitlist_entries
        where raid_train_id = p_train_id and status = 'offered' and offer_expires_at < now()
      );

  update waitlist_entries
    set status = 'expired', offered_slot_id = null, offer_expires_at = null
    where raid_train_id = p_train_id and status = 'offered' and offer_expires_at < now();
end;
$$;

revoke all on function public.release_expired_waitlist_offers_for_train(uuid) from public;
grant execute on function public.release_expired_waitlist_offers_for_train(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- swap_train_slot_sellers — the atomic operation behind the schedule
-- manager's drag-and-drop. Swaps whichever seller/application is on slot A
-- with whichever is on slot B (either side may be empty), keeping
-- train_applications.slot_id and train_participants.slot_id in sync so
-- nothing points at a stale slot after the swap. Locks both rows up front
-- so a concurrent write (e.g. a seller cancelling) can't interleave with
-- the swap and leave things inconsistent.
-- ----------------------------------------------------------------------------
create or replace function public.swap_train_slot_sellers(p_slot_a_id uuid, p_slot_b_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a train_slots;
  v_b train_slots;
  v_train_id uuid;
begin
  if p_slot_a_id = p_slot_b_id then
    return;
  end if;

  select * into v_a from train_slots where id = p_slot_a_id for update;
  select * into v_b from train_slots where id = p_slot_b_id for update;

  if v_a.id is null or v_b.id is null then
    raise exception 'Slot not found.';
  end if;
  if v_a.raid_train_id <> v_b.raid_train_id then
    raise exception 'Slots must belong to the same train.';
  end if;

  v_train_id := v_a.raid_train_id;

  if not exists (
    select 1 from raid_trains rt
    join organizer_profiles op on op.id = rt.organizer_id
    where rt.id = v_train_id and op.user_id = auth.uid()
  ) then
    raise exception 'Not authorized to manage this train.';
  end if;

  update train_slots
    set seller_id = v_b.seller_id, application_id = v_b.application_id,
        status = v_b.status, held_until = v_b.held_until
    where id = p_slot_a_id;

  update train_slots
    set seller_id = v_a.seller_id, application_id = v_a.application_id,
        status = v_a.status, held_until = v_a.held_until
    where id = p_slot_b_id;

  if v_a.application_id is not null then
    update train_applications set slot_id = p_slot_b_id where id = v_a.application_id;
  end if;
  if v_b.application_id is not null then
    update train_applications set slot_id = p_slot_a_id where id = v_b.application_id;
  end if;

  if v_a.seller_id is not null then
    update train_participants set slot_id = p_slot_b_id
      where slot_id = p_slot_a_id and seller_id = v_a.seller_id;
  end if;
  if v_b.seller_id is not null then
    update train_participants set slot_id = p_slot_a_id
      where slot_id = p_slot_b_id and seller_id = v_b.seller_id;
  end if;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (v_train_id, auth.uid(), 'slots_swapped', jsonb_build_object('slot_a', p_slot_a_id, 'slot_b', p_slot_b_id));
end;
$$;

revoke all on function public.swap_train_slot_sellers(uuid, uuid) from public;
grant execute on function public.swap_train_slot_sellers(uuid, uuid) to authenticated;
