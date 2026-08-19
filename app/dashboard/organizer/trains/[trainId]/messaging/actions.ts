"use server";

import { revalidatePath } from "next/cache";
import { assertCanManageTrain } from "@/lib/trains/access";
import { sendNotification, getUserIdForSeller } from "@/lib/notifications/send";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import type { NotificationType } from "@/types/database.types";

export interface MessageFormState {
  error?: string;
  success?: string;
}

function revalidateMessaging(trainId: string) {
  revalidatePath(`/dashboard/organizer/trains/${trainId}/messaging`);
}

function readSubjectAndMessage(formData: FormData): { subject: string; message: string } | { error: string } {
  const subject = formData.get("subject");
  const message = formData.get("message");
  if (typeof subject !== "string" || !subject.trim()) return { error: "Subject is required." };
  if (typeof message !== "string" || !message.trim()) return { error: "Message is required." };
  return { subject: subject.trim(), message: message.trim() };
}

/** Emails every seller currently confirmed (a train_participants row) for this train. */
export async function messageAllSellers(
  trainId: string,
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const { supabase } = await assertCanManageTrain(trainId);

  const parsed = readSubjectAndMessage(formData);
  if ("error" in parsed) return parsed;

  const { data: train } = await supabase.from("raid_trains").select("name").eq("id", trainId).maybeSingle();
  if (!train) return { error: "Train not found." };

  const { data: participants } = await supabase
    .from("train_participants")
    .select("seller_id")
    .eq("raid_train_id", trainId);

  const sellerIds = [...new Set((participants ?? []).map((p) => p.seller_id))];
  if (sellerIds.length === 0) return { error: "No confirmed sellers to message yet." };

  const { data: sellerProfiles } = await supabase
    .from("seller_profiles")
    .select("id, user_id")
    .in("id", sellerIds);

  let sentCount = 0;
  for (const seller of sellerProfiles ?? []) {
    await sendNotification({
      userId: seller.user_id,
      raidTrainId: trainId,
      type: "custom",
      data: { trainName: train.name, subject: parsed.subject, message: parsed.message },
    });
    sentCount += 1;
  }

  revalidateMessaging(trainId);
  return { success: `Sent to ${sentCount} seller${sentCount === 1 ? "" : "s"}.` };
}

/** Emails a single seller a custom subject/message. */
export async function messageOneSeller(
  trainId: string,
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const { supabase } = await assertCanManageTrain(trainId);

  const sellerId = formData.get("sellerId");
  if (typeof sellerId !== "string" || !sellerId) return { error: "Choose a seller." };

  const parsed = readSubjectAndMessage(formData);
  if ("error" in parsed) return parsed;

  const { data: train } = await supabase.from("raid_trains").select("name").eq("id", trainId).maybeSingle();
  if (!train) return { error: "Train not found." };

  const userId = await getUserIdForSeller(sellerId);
  if (!userId) return { error: "Seller not found." };

  await sendNotification({
    userId,
    raidTrainId: trainId,
    type: "custom",
    data: { trainName: train.name, subject: parsed.subject, message: parsed.message },
  });

  revalidateMessaging(trainId);
  return { success: "Message sent." };
}

export type QuickMessageKind = "reminder" | "check_in" | "you_are_next";

const QUICK_MESSAGE_TYPE: Record<QuickMessageKind, NotificationType> = {
  reminder: "reminder_2h",
  check_in: "check_in_reminder",
  you_are_next: "you_are_next",
};

/** One-click send of a reminder / check-in notice / you're-next notice to one seller. */
export async function sendQuickMessage(trainId: string, sellerId: string, kind: QuickMessageKind) {
  const { supabase } = await assertCanManageTrain(trainId);

  const { data: train } = await supabase
    .from("raid_trains")
    .select("name, timezone")
    .eq("id", trainId)
    .maybeSingle();
  if (!train) return;

  const userId = await getUserIdForSeller(sellerId);
  if (!userId) return;

  const { data: participant } = await supabase
    .from("train_participants")
    .select("slot_id, show_url")
    .eq("raid_train_id", trainId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  let slotTime: string | undefined;
  if (participant?.slot_id) {
    const { data: slot } = await supabase
      .from("train_slots")
      .select("start_datetime")
      .eq("id", participant.slot_id)
      .maybeSingle();
    if (slot) slotTime = formatSlotTime(slot.start_datetime, train.timezone);
  }

  await sendNotification({
    userId,
    raidTrainId: trainId,
    type: QUICK_MESSAGE_TYPE[kind],
    data: { trainName: train.name, slotTime, showUrl: participant?.show_url },
  });

  revalidateMessaging(trainId);
}
