"use server";

import { revalidatePath } from "next/cache";
import { assertCanManageTrain } from "@/lib/trains/access";
import { sendNotification, getUserIdForSeller } from "@/lib/notifications/send";
import { formatSlotTime } from "@/lib/trains/generate-slots";

function revalidateTrain(trainId: string) {
  revalidatePath(`/dashboard/organizer/trains/${trainId}/waitlist`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}/schedule`);
}

const OFFER_WINDOW_HOURS = 48;

export async function offerSlot(trainId: string, waitlistEntryId: string, formData: FormData) {
  const { supabase, userId, train } = await assertCanManageTrain(trainId);
  const slotId = formData.get("slotId");
  if (typeof slotId !== "string" || !slotId) return;

  const { data: entry } = await supabase
    .from("waitlist_entries")
    .select("id, seller_id, status")
    .eq("id", waitlistEntryId)
    .maybeSingle();
  if (!entry || entry.status !== "waiting") return;

  const { data: slot } = await supabase
    .from("train_slots")
    .select("id, status")
    .eq("id", slotId)
    .eq("raid_train_id", trainId)
    .maybeSingle();
  if (!slot || slot.status !== "open") return;

  const expiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  await supabase
    .from("train_slots")
    .update({ status: "held", seller_id: entry.seller_id, held_until: expiresAt })
    .eq("id", slotId);

  await supabase
    .from("waitlist_entries")
    .update({ status: "offered", offered_slot_id: slotId, offer_expires_at: expiresAt })
    .eq("id", entry.id);

  const sellerUserId = await getUserIdForSeller(entry.seller_id);
  if (sellerUserId) {
    const { data: slotTimes } = await supabase
      .from("train_slots")
      .select("start_datetime")
      .eq("id", slotId)
      .maybeSingle();

    await sendNotification({
      userId: sellerUserId,
      raidTrainId: trainId,
      type: "replacement_offer",
      data: {
        trainName: train.name,
        slotTime: slotTimes ? formatSlotTime(slotTimes.start_datetime, train.timezone) : undefined,
        expiresAt: new Date(expiresAt).toLocaleString(),
      },
    });
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "waitlist_slot_offered",
    action_details: { waitlist_entry_id: entry.id, slot_id: slotId },
  });

  revalidateTrain(trainId);
}

export async function removeFromWaitlist(trainId: string, waitlistEntryId: string) {
  const { supabase, userId } = await assertCanManageTrain(trainId);

  await supabase.from("waitlist_entries").update({ status: "removed" }).eq("id", waitlistEntryId);

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "waitlist_entry_removed",
    action_details: { waitlist_entry_id: waitlistEntryId },
  });

  revalidateTrain(trainId);
}
