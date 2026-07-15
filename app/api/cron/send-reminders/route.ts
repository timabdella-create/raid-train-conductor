import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendNotification, getUserIdForSeller } from "@/lib/notifications/send";
import { formatSlotTime } from "@/lib/trains/generate-slots";

export const dynamic = "force-dynamic";

// How far ahead/behind "now" we're willing to look for candidate slots. Wide
// enough to tolerate the cron being paused for a while, narrow enough that a
// stale participant row from months ago can't suddenly fire a reminder.
const LOOKBEHIND_MS = 2 * 24 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 2 * 24 * 60 * 60 * 1000;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface ReminderResult {
  participantId: string;
  sent: ("reminder_24h" | "reminder_2h" | "check_in_reminder")[];
}

/**
 * Scans confirmed train_participants for slots starting soon and sends the
 * 24h / 2h / check-in reminder that's now due, guarded by the
 * reminder_*_sent_at columns so a reminder never goes out twice even if this
 * route runs more often than the underlying cron schedule.
 *
 * Protected by CRON_SECRET — configure the same value in your hosting
 * provider's cron job (see vercel.json) and in the environment. Requests
 * without a matching `Authorization: Bearer <secret>` header are rejected.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now - LOOKBEHIND_MS).toISOString();
  const windowEnd = new Date(now + LOOKAHEAD_MS).toISOString();

  const { data: participants, error: participantsError } = await supabase
    .from("train_participants")
    .select(
      "id, raid_train_id, seller_id, slot_id, confirmation_status, check_in_status, show_url, reminder_24h_sent_at, reminder_2h_sent_at, checkin_reminder_sent_at"
    )
    .not("slot_id", "is", null)
    .neq("confirmation_status", "declined")
    .or("reminder_24h_sent_at.is.null,reminder_2h_sent_at.is.null,checkin_reminder_sent_at.is.null");

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  if (!participants || participants.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, results: [] as ReminderResult[] });
  }

  const slotIds = [...new Set(participants.map((p) => p.slot_id).filter((id): id is string => Boolean(id)))];
  const { data: slots } = await supabase
    .from("train_slots")
    .select("id, raid_train_id, start_datetime")
    .in("id", slotIds)
    .gte("start_datetime", windowStart)
    .lte("start_datetime", windowEnd);
  const slotById = new Map((slots ?? []).map((s) => [s.id, s]));

  const trainIds = [...new Set((slots ?? []).map((s) => s.raid_train_id))];
  const { data: trains } =
    trainIds.length > 0
      ? await supabase
          .from("raid_trains")
          .select("id, name, timezone, status, check_in_minutes_before")
          .in("id", trainIds)
      : { data: [] as { id: string; name: string; timezone: string; status: string; check_in_minutes_before: number }[] };
  const trainById = new Map((trains ?? []).map((t) => [t.id, t]));

  const results: ReminderResult[] = [];

  for (const participant of participants) {
    const slot = participant.slot_id ? slotById.get(participant.slot_id) : undefined;
    if (!slot) continue; // outside the lookaround window, or slot missing

    const train = trainById.get(slot.raid_train_id);
    if (!train) continue;
    if (train.status === "cancelled" || train.status === "completed") continue;

    const slotStartMs = new Date(slot.start_datetime).getTime();
    const sent: ReminderResult["sent"] = [];

    const userId = await getUserIdForSeller(participant.seller_id);
    if (!userId) continue;

    const slotTime = formatSlotTime(slot.start_datetime, train.timezone);

    if (!participant.reminder_24h_sent_at && now >= slotStartMs - TWENTY_FOUR_HOURS_MS && now < slotStartMs) {
      await sendNotification({
        userId,
        raidTrainId: train.id,
        type: "reminder_24h",
        data: { trainName: train.name, slotTime, showUrl: participant.show_url },
      });
      const { error } = await supabase
        .from("train_participants")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", participant.id)
        .is("reminder_24h_sent_at", null);
      if (!error) sent.push("reminder_24h");
    }

    if (!participant.reminder_2h_sent_at && now >= slotStartMs - TWO_HOURS_MS && now < slotStartMs) {
      await sendNotification({
        userId,
        raidTrainId: train.id,
        type: "reminder_2h",
        data: { trainName: train.name, slotTime, showUrl: participant.show_url },
      });
      const { error } = await supabase
        .from("train_participants")
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq("id", participant.id)
        .is("reminder_2h_sent_at", null);
      if (!error) sent.push("reminder_2h");
    }

    const checkInOpensAtMs = slotStartMs - train.check_in_minutes_before * 60_000;
    if (
      !participant.checkin_reminder_sent_at &&
      participant.check_in_status === "not_checked_in" &&
      now >= checkInOpensAtMs &&
      now < slotStartMs
    ) {
      await sendNotification({
        userId,
        raidTrainId: train.id,
        type: "check_in_reminder",
        data: { trainName: train.name, slotTime, showUrl: participant.show_url },
      });
      const { error } = await supabase
        .from("train_participants")
        .update({ checkin_reminder_sent_at: new Date().toISOString() })
        .eq("id", participant.id)
        .is("checkin_reminder_sent_at", null);
      if (!error) sent.push("check_in_reminder");
    }

    if (sent.length > 0) results.push({ participantId: participant.id, sent });
  }

  return NextResponse.json({
    processed: participants.length,
    sent: results.reduce((n, r) => n + r.sent.length, 0),
    results,
  });
}
