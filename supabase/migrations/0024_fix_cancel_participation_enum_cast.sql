-- Fix: cancel_train_participation's INSERT INTO seller_history used a CASE
-- expression with untyped string literals for the attendance_status enum
-- column. Postgres resolves an all-string-literal CASE to text in raw SQL
-- contexts (INSERT...VALUES), which then fails to implicitly cast to the
-- enum column, raising "column attendance_status is of type
-- attendance_status but expression is of type text". This exception rolled
-- back the whole function (slot release, application withdrawal, and
-- participant delete all undone), but the calling code never checked the
-- RPC's error, so sellers saw a "cancelled" confirmation and a Discord
-- notification even though nothing actually changed. Same class of bug as
-- migration 0021's fix for submit_train_application.

CREATE OR REPLACE FUNCTION public.cancel_train_participation(p_train_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    set status = 'open', seller_id = null, held_until = null
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
    (case when v_notice_hours >= 24 then 'cancelled_with_notice' else 'last_minute_cancellation' end)::attendance_status,
    v_notice_hours
  )
  on conflict (seller_id, raid_train_id) do update
    set attendance_status = excluded.attendance_status,
        cancellation_notice_hours = excluded.cancellation_notice_hours;

  insert into train_activity_log (raid_train_id, user_id, action_type, action_details)
  values (p_train_id, auth.uid(), 'seller_cancelled', jsonb_build_object('seller_id', v_seller_id, 'notice_hours', v_notice_hours));
end;
$function$;
