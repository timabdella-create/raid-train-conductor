"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, getUserIdForSeller } from "@/lib/notifications/send";

async function assertOrganizerOwnsTrain(trainId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, organizer_id")
    .eq("id", trainId)
    .maybeSingle();
  if (!train) throw new Error("Train not found.");

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!organizerProfile || organizerProfile.id !== train.organizer_id) {
    throw new Error("Not authorized.");
  }

  return { supabase, userId: user.id };
}

function revalidateTrain(trainId: string) {
  revalidatePath(`/dashboard/organizer/trains/${trainId}/schedule`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}/applications`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}/waitlist`);
}

export async function swapSlotSellers(trainId: string, slotAId: string, slotBId: string) {
  const { supabase } = await assertOrganizerOwnsTrain(trainId);
  await supabase.rpc("swap_train_slot_sellers", { p_slot_a_id: slotAId, p_slot_b_id: slotBId });
  revalidateTrain(trainId);
}

/** Organizer-initiated removal of a confirmed/pending seller — frees the slot and logs history. */
export async function removeSellerFromSlot(trainId: string, slotId: string) {
  const { supabase, userId } = await assertOrganizerOwnsTrain(trainId);

  const { data: slot } = await supabase
    .from("train_slots")
    .select("id, seller_id, application_id")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot || !slot.seller_id) return;

  const sellerId = slot.seller_id;

  await supabase
    .from("train_slots")
    .update({ status: "open", seller_id: null, application_id: null, held_until: null })
    .eq("id", slotId);

  if (slot.application_id) {
    await supabase.from("train_applications").update({ status: "withdrawn" }).eq("id", slot.application_id);
  }

  await supabase.from("train_participants").delete().eq("raid_train_id", trainId).eq("seller_id", sellerId);

  const { data: train } = await supabase
    .from("raid_trains")
    .select("name, organizer_id")
    .eq("id", trainId)
    .single();

  await supabase.from("seller_history").upsert(
    {
      seller_id: sellerId,
      raid_train_id: trainId,
      organizer_id: train!.organizer_id,
      attendance_status: "cancelled_with_notice",
      private_notes: "Removed by organizer.",
    },
    { onConflict: "seller_id,raid_train_id" }
  );

  const sellerUserId = await getUserIdForSeller(sellerId);
  if (sellerUserId) {
    await sendNotification({
      userId: sellerUserId,
      raidTrainId: trainId,
      type: "cancellation_confirmation",
      data: { trainName: train!.name, initiatedByOrganizer: true },
    });
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "seller_removed_by_organizer",
    action_details: { slot_id: slotId, seller_id: sellerId },
  });

  revalidateTrain(trainId);
}

/** Takes an empty slot out of rotation entirely, or brings it back. */
export async function toggleSlotAvailability(trainId: string, slotId: string, makeUnavailable: boolean) {
  const { supabase, userId } = await assertOrganizerOwnsTrain(trainId);

  const { data: slot } = await supabase.from("train_slots").select("id, seller_id, status").eq("id", slotId).maybeSingle();
  if (!slot || slot.seller_id) return; // never toggle a slot that has someone assigned

  await supabase
    .from("train_slots")
    .update({ status: makeUnavailable ? "cancelled" : "open" })
    .eq("id", slotId);

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: makeUnavailable ? "slot_marked_unavailable" : "slot_marked_available",
    action_details: { slot_id: slotId },
  });

  revalidateTrain(trainId);
}

export async function checkInSellerManually(trainId: string, slotId: string) {
  const { supabase } = await assertOrganizerOwnsTrain(trainId);

  const { data: slot } = await supabase.from("train_slots").select("seller_id").eq("id", slotId).maybeSingle();
  if (!slot?.seller_id) return;

  await supabase
    .from("train_participants")
    .update({ check_in_status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("raid_train_id", trainId)
    .eq("seller_id", slot.seller_id);

  revalidateTrain(trainId);
}

export async function undoCheckIn(trainId: string, slotId: string) {
  const { supabase } = await assertOrganizerOwnsTrain(trainId);

  const { data: slot } = await supabase.from("train_slots").select("seller_id").eq("id", slotId).maybeSingle();
  if (!slot?.seller_id) return;

  await supabase
    .from("train_participants")
    .update({ check_in_status: "not_checked_in", checked_in_at: null })
    .eq("raid_train_id", trainId)
    .eq("seller_id", slot.seller_id);

  revalidateTrain(trainId);
}
