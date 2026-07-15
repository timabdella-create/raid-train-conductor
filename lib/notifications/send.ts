import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { buildNotificationContent, type NotificationData } from "@/lib/notifications/templates";
import type { NotificationType } from "@/types/database.types";

export interface SendNotificationInput {
  userId: string;
  raidTrainId?: string | null;
  type: NotificationType;
  data: NotificationData;
}

/**
 * Writes a notifications row and attempts to actually deliver it by email.
 * Uses the service-role client because the recipient is very often not the
 * person performing the action (an organizer approving an application
 * writes a notification FOR the seller; a seller cancelling writes one FOR
 * the organizer) — regular RLS insert policies don't cover every one of
 * those directions, and re-deriving a policy for each direction would add
 * RLS surface area for a purely internal, server-only write path. Never
 * call this from client code.
 */
export async function sendNotification({ userId, raidTrainId, type, data }: SendNotificationInput) {
  const supabase = createAdminClient();

  const { data: userRow } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
  if (!userRow) return;

  const { subject, html, text } = buildNotificationContent(type, data);

  const { data: notification } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      raid_train_id: raidTrainId ?? null,
      notification_type: type,
      subject,
      message: text,
      delivery_method: "email",
      delivery_status: "queued",
    })
    .select("id")
    .single();

  const result = await sendEmail({ to: userRow.email, subject, html });

  if (notification) {
    await supabase
      .from("notifications")
      .update({
        delivery_status: result.sent ? "sent" : "queued",
        sent_at: result.sent ? new Date().toISOString() : null,
      })
      .eq("id", notification.id);
  }

  return result;
}

/** Looks up a seller's auth user id from their seller_profiles.id — a common need before sendNotification. */
export async function getUserIdForSeller(sellerId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("seller_profiles").select("user_id").eq("id", sellerId).maybeSingle();
  return data?.user_id ?? null;
}

/** Looks up an organizer's auth user id from their organizer_profiles.id. */
export async function getUserIdForOrganizer(organizerId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("organizer_profiles").select("user_id").eq("id", organizerId).maybeSingle();
  return data?.user_id ?? null;
}
