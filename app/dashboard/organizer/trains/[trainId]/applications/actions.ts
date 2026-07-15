"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, getUserIdForSeller } from "@/lib/notifications/send";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import type { NotificationType } from "@/types/database.types";

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
  revalidatePath(`/dashboard/organizer/trains/${trainId}/applications`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}`);
  revalidatePath(`/dashboard/organizer/trains/${trainId}/schedule`);
}

async function notifySeller(
  trainId: string,
  sellerId: string,
  type: NotificationType,
  extra: { slotId?: string | null; position?: number } = {}
) {
  const supabase = createClient();
  const { data: train } = await supabase.from("raid_trains").select("name, timezone").eq("id", trainId).maybeSingle();
  if (!train) return;

  const userId = await getUserIdForSeller(sellerId);
  if (!userId) return;

  let slotTime: string | undefined;
  if (extra.slotId) {
    const { data: slot } = await supabase
      .from("train_slots")
      .select("start_datetime")
      .eq("id", extra.slotId)
      .maybeSingle();
    if (slot) slotTime = formatSlotTime(slot.start_datetime, train.timezone);
  }

  await sendNotification({
    userId,
    raidTrainId: trainId,
    type,
    data: { trainName: train.name, slotTime, position: extra.position },
  });
}

export async function approveApplication(trainId: string, applicationId: string) {
  const { supabase, userId } = await assertOrganizerOwnsTrain(trainId);

  const { data: application } = await supabase
    .from("train_applications")
    .select("id, slot_id, seller_id, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application || application.status !== "pending") return;

  await supabase.from("train_applications").update({ status: "approved" }).eq("id", applicationId);

  if (application.slot_id) {
    await supabase.from("train_slots").update({ status: "confirmed" }).eq("id", application.slot_id);
  }

  await supabase.from("train_participants").insert({
    raid_train_id: trainId,
    seller_id: application.seller_id,
    slot_id: application.slot_id,
    confirmation_status: "confirmed",
  });

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "application_approved",
    action_details: { application_id: applicationId },
  });

  await notifySeller(trainId, application.seller_id, "application_approved", { slotId: application.slot_id });

  revalidateTrain(trainId);
}

export async function rejectApplication(trainId: string, applicationId: string) {
  const { supabase, userId } = await assertOrganizerOwnsTrain(trainId);

  const { data: application } = await supabase
    .from("train_applications")
    .select("id, slot_id, seller_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return;

  await supabase.from("train_applications").update({ status: "rejected" }).eq("id", applicationId);

  if (application.slot_id) {
    await supabase
      .from("train_slots")
      .update({ status: "open", seller_id: null, application_id: null, held_until: null })
      .eq("id", application.slot_id);
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "application_rejected",
    action_details: { application_id: applicationId },
  });

  await notifySeller(trainId, application.seller_id, "application_rejected");

  revalidateTrain(trainId);
}

export async function addApplicationToWaitlist(trainId: string, applicationId: string) {
  const { supabase, userId } = await assertOrganizerOwnsTrain(trainId);

  const { data: application } = await supabase
    .from("train_applications")
    .select("id, slot_id, seller_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return;

  await supabase.from("train_applications").update({ status: "waitlisted" }).eq("id", applicationId);

  if (application.slot_id) {
    await supabase
      .from("train_slots")
      .update({ status: "open", seller_id: null, application_id: null, held_until: null })
      .eq("id", application.slot_id);
  }

  const { data: existingEntry } = await supabase
    .from("waitlist_entries")
    .select("id")
    .eq("raid_train_id", trainId)
    .eq("seller_id", application.seller_id)
    .maybeSingle();

  let waitlistPosition: number | undefined;
  if (!existingEntry) {
    const { data: entries } = await supabase
      .from("waitlist_entries")
      .select("position")
      .eq("raid_train_id", trainId)
      .order("position", { ascending: false })
      .limit(1);

    waitlistPosition = (entries?.[0]?.position ?? 0) + 1;
    await supabase.from("waitlist_entries").insert({
      raid_train_id: trainId,
      seller_id: application.seller_id,
      position: waitlistPosition,
      status: "waiting",
    });
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "application_waitlisted",
    action_details: { application_id: applicationId },
  });

  await notifySeller(trainId, application.seller_id, "added_to_waitlist", { position: waitlistPosition });

  revalidateTrain(trainId);
}

export async function moveApplicationToSlot(trainId: string, applicationId: string, formData: FormData) {
  const { supabase, userId } = await assertOrganizerOwnsTrain(trainId);
  const newSlotId = formData.get("newSlotId");
  if (typeof newSlotId !== "string" || !newSlotId) return;

  const { data: application } = await supabase
    .from("train_applications")
    .select("id, slot_id, seller_id, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return;

  const { data: newSlot } = await supabase
    .from("train_slots")
    .select("id, status")
    .eq("id", newSlotId)
    .eq("raid_train_id", trainId)
    .maybeSingle();
  if (!newSlot || newSlot.status !== "open") return;

  if (application.slot_id) {
    await supabase
      .from("train_slots")
      .update({ status: "open", seller_id: null, application_id: null, held_until: null })
      .eq("id", application.slot_id);
  }

  const nextStatus = application.status === "approved" ? "confirmed" : "pending_approval";
  await supabase
    .from("train_slots")
    .update({ status: nextStatus, seller_id: application.seller_id, application_id: application.id })
    .eq("id", newSlotId);

  await supabase.from("train_applications").update({ slot_id: newSlotId }).eq("id", applicationId);

  if (application.status === "approved") {
    await supabase
      .from("train_participants")
      .update({ slot_id: newSlotId })
      .eq("raid_train_id", trainId)
      .eq("seller_id", application.seller_id);
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: userId,
    action_type: "application_moved_slot",
    action_details: { application_id: applicationId, new_slot_id: newSlotId },
  });

  await notifySeller(trainId, application.seller_id, "slot_changed", { slotId: newSlotId });

  revalidateTrain(trainId);
}
