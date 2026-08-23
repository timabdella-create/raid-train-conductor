-- submit_train_application() relied entirely on the
-- train_applications_active_unique partial index (added in migration 0023)
-- to reject a second application while one is already pending/approved on
-- the same train. That's correct behavior, but the raw Postgres error —
-- "duplicate key value violates unique constraint
-- train_applications_active_unique" — was leaking straight through
-- supabase-js's `error.message` into the seller-facing form error banner
-- (app/train/[slug]/apply/actions.ts just does `return { error:
-- error.message }` with no special-casing). This happens whenever a seller
-- holds a second slot on a train they're already pending/approved on and
-- tries to submit it. Add an explicit pre-check that raises a plain-English
-- exception instead, so the constraint stays as a defense-in-depth backstop
-- rather than the primary (and only user-visible) error path.
create or replace function public.submit_train_application(
  p_slot_id uuid,
  p_seller_notes text default null,
  p_show_url text default null,
  p_custom_answers jsonb default '[]'::jsonb,
  p_invite_code text default null
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
  if v_train.signup_mode = 'waitlist_only' then
    raise exception 'This train does not accept direct applications.';
  end if;
  if v_train.signup_mode = 'invite_only' then
    if v_train.invite_code is null or p_invite_code is null or p_invite_code <> v_train.invite_code then
      raise exception 'This train requires a valid invite code to join.';
    end if;
  end if;

  if exists (
    select 1 from train_applications
    where raid_train_id = v_train.id
      and seller_id = v_seller_id
      and status in ('pending', 'approved')
  ) then
    raise exception 'You already have an active application on this train. Check your applications, or cancel it first if you want a different slot.';
  end if;

  -- Open signup and a correctly-coded invite_only application both skip
  -- organizer review; approval_required is the only mode left pending.
  v_status := case
    when v_train.signup_mode = 'open' then 'approved'
    when v_train.signup_mode = 'invite_only' then 'approved'
    else 'pending'
  end;

  insert into train_applications
    (raid_train_id, slot_id, seller_id, status, seller_notes, show_url, custom_answers)
  values
    (v_train.id, v_slot.id, v_seller_id, v_status, nullif(p_seller_notes, ''), nullif(p_show_url, ''), coalesce(p_custom_answers, '[]'::jsonb))
  returning * into v_application;

  update train_slots
    set status = case when v_status = 'approved' then 'confirmed'::slot_status else 'pending_approval'::slot_status end,
        application_id = v_application.id,
        held_until = null
    where id = v_slot.id;

  if v_status = 'approved' then
    insert into train_participants (raid_train_id, seller_id, slot_id, confirmation_status, show_url)
    values (v_train.id, v_seller_id, v_slot.id, 'confirmed', nullif(p_show_url, ''));
  end if;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (
    v_train.id,
    auth.uid(),
    'seller_applied',
    jsonb_build_object('slot_id', v_slot.id, 'result', v_status, 'via_invite_code', v_train.signup_mode = 'invite_only')
  );

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

revoke all on function public.submit_train_application(uuid, text, text, jsonb, text) from public;
grant execute on function public.submit_train_application(uuid, text, text, jsonb, text) to authenticated;
