"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, getUserIdForOrganizer } from "@/lib/notifications/send";
import { notifyDiscordSlotOpened } from "@/lib/discord/webhook";
import { formatSlotTime } from "@/lib/trains/generate-slots";

const sellerProfileSchema = z.object({
  whatnotUsername: z.string().trim().min(2, "Enter your Whatnot username.").max(50),
  whatnotProfileUrl: z
    .string()
    .trim()
    .url("Enter a full URL, e.g. https://www.whatnot.com/user/yourname")
    .refine((url) => url.startsWith("https://"), "Profile URL must use https://"),
  sellerCategory: z.string().trim().max(50).optional().or(z.literal("")),
  groupMode: z.enum(["none", "existing", "new"]).default("none"),
  existingGroupId: z.string().uuid().optional().or(z.literal("")),
  newGroupName: z.string().trim().min(2, "Give the group a name.").max(60).optional().or(z.literal("")),
  newGroupIconUrl: z.string().trim().url().optional().or(z.literal("")),
});

export type SellerProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Handles both first-time setup and later edits: upserting on the
// user_id unique constraint means an existing profile gets updated in
// place (same row, same id) rather than duplicated.
export async function saveSellerProfile(
  _prevState: SellerProfileFormState,
  formData: FormData
): Promise<SellerProfileFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  // FormData.get() returns null (not undefined) for any field that isn't
  // present in the submitted form -- and since the group name/icon inputs
  // only render when groupMode is "new" (same for existingGroupId when
  // it's "existing"), those keys are frequently absent entirely. Zod's
  // .optional() only accepts undefined, not null, so without this
  // normalization every save with groupMode "none" or "existing" failed
  // validation on the *other* mode's now-absent fields -- silently, since
  // the resulting fieldErrors were keyed to inputs that weren't even on
  // screen to display them.
  const nullToUndefined = (value: FormDataEntryValue | null) => (value === null ? undefined : value);

  const parsed = sellerProfileSchema.safeParse({
    whatnotUsername: formData.get("whatnotUsername"),
    whatnotProfileUrl: formData.get("whatnotProfileUrl"),
    sellerCategory: nullToUndefined(formData.get("sellerCategory")),
    groupMode: formData.get("groupMode") || "none",
    existingGroupId: nullToUndefined(formData.get("existingGroupId")),
    newGroupName: nullToUndefined(formData.get("newGroupName")),
    newGroupIconUrl: nullToUndefined(formData.get("newGroupIconUrl")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  let groupId: string | null = null;

  if (parsed.data.groupMode === "existing") {
    if (!parsed.data.existingGroupId) {
      return { error: "Choose a group, or switch back to \"No group\"." };
    }
    groupId = parsed.data.existingGroupId;
  } else if (parsed.data.groupMode === "new") {
    if (!parsed.data.newGroupName) {
      return { fieldErrors: { newGroupName: "Give the group a name." } };
    }
    if (!parsed.data.newGroupIconUrl) {
      return { fieldErrors: { newGroupIconUrl: "Upload an icon for the group." } };
    }
    const { data: newGroup, error: groupError } = await supabase
      .from("seller_groups")
      .insert({
        name: parsed.data.newGroupName,
        icon_url: parsed.data.newGroupIconUrl,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (groupError || !newGroup) {
      return { error: groupError?.message ?? "Couldn't create that group." };
    }
    groupId = newGroup.id;
  }

  const { error } = await supabase.from("seller_profiles").upsert(
    {
      user_id: user.id,
      whatnot_username: parsed.data.whatnotUsername,
      whatnot_profile_url: parsed.data.whatnotProfileUrl,
      seller_category: parsed.data.sellerCategory || null,
      group_id: groupId,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/seller");
  revalidatePath("/dashboard/profile");
  return {};
}

export async function cancelParticipation(trainId: string): Promise<{ error?: string } | void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Captured before the RPC runs — cancel_train_participation deletes the
  // train_participants row, so this is our only chance to know which slot
  // (and thus what time) the seller is dropping.
  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("id, whatnot_username")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: participantBefore } = sellerProfile
    ? await supabase
        .from("train_participants")
        .select("slot_id")
        .eq("raid_train_id", trainId)
        .eq("seller_id", sellerProfile.id)
        .maybeSingle()
    : { data: null };
  const { data: slotBefore } = participantBefore?.slot_id
    ? await supabase.from("train_slots").select("start_datetime").eq("id", participantBefore.slot_id).maybeSingle()
    : { data: null };

  const { error: cancelError } = await supabase.rpc("cancel_train_participation", {
    p_train_id: trainId,
  });
  if (cancelError) {
    // Bail out before sending any "you're cancelled" notifications or
    // posting to Discord — the slot/application/participant rows were not
    // actually changed if the RPC failed.
    return { error: cancelError.message };
  }

  const { data: train } = await supabase
    .from("raid_trains")
    .select("name, organizer_id, slug, discord_webhook_url, timezone")
    .eq("id", trainId)
    .maybeSingle();

  if (train) {
    await sendNotification({
      userId: user.id,
      raidTrainId: trainId,
      type: "cancellation_confirmation",
      data: { trainName: train.name, initiatedByOrganizer: false },
    });

    const organizerUserId = await getUserIdForOrganizer(train.organizer_id);
    if (organizerUserId) {
      await sendNotification({
        userId: organizerUserId,
        raidTrainId: trainId,
        type: "custom",
        data: {
          trainName: train.name,
          subject: `A seller cancelled on ${train.name}`,
          message: "One of your confirmed sellers just cancelled their slot. It's back to open — check the schedule manager to fill it or offer it to your waitlist.",
        },
      });
    }

    if (train.discord_webhook_url) {
      const { count } = await supabase
        .from("train_slots")
        .select("id", { count: "exact", head: true })
        .eq("raid_train_id", trainId)
        .eq("status", "open");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      await notifyDiscordSlotOpened({
        webhookUrl: train.discord_webhook_url,
        trainName: train.name,
        trainUrl: `${siteUrl}/train/${train.slug}`,
        openSlotCount: count ?? 0,
        sellerName: sellerProfile?.whatnot_username ? `@${sellerProfile.whatnot_username}` : null,
        slotTime: slotBefore?.start_datetime ? formatSlotTime(slotBefore.start_datetime, train.timezone) : null,
      });
    }
  }

  revalidatePath("/dashboard/seller/upcoming");
  revalidatePath("/dashboard/seller");
}

export async function acceptWaitlistOffer(waitlistEntryId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("accept_waitlist_offer", { p_waitlist_entry_id: waitlistEntryId });

  revalidatePath("/dashboard/seller/waitlist");
  revalidatePath("/dashboard/seller/upcoming");
  revalidatePath("/dashboard/seller");
}

export async function declineWaitlistOffer(waitlistEntryId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("decline_waitlist_offer", { p_waitlist_entry_id: waitlistEntryId });

  revalidatePath("/dashboard/seller/waitlist");
}

export async function checkInToTrain(participantId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("train_participants")
    .update({ check_in_status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("id", participantId);

  revalidatePath("/dashboard/seller/upcoming");
}
