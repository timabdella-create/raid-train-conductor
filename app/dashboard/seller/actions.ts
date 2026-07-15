"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, getUserIdForOrganizer } from "@/lib/notifications/send";

const sellerProfileSchema = z.object({
  whatnotUsername: z.string().trim().min(2, "Enter your Whatnot username.").max(50),
  whatnotProfileUrl: z
    .string()
    .trim()
    .url("Enter a full URL, e.g. https://www.whatnot.com/user/yourname")
    .refine((url) => url.startsWith("https://"), "Profile URL must use https://"),
  sellerCategory: z.string().trim().max(50).optional().or(z.literal("")),
});

export type SellerProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createSellerProfile(
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

  const parsed = sellerProfileSchema.safeParse({
    whatnotUsername: formData.get("whatnotUsername"),
    whatnotProfileUrl: formData.get("whatnotProfileUrl"),
    sellerCategory: formData.get("sellerCategory"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { error } = await supabase.from("seller_profiles").insert({
    user_id: user.id,
    whatnot_username: parsed.data.whatnotUsername,
    whatnot_profile_url: parsed.data.whatnotProfileUrl,
    seller_category: parsed.data.sellerCategory || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/seller");
  return {};
}

export async function cancelParticipation(trainId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("cancel_train_participation", { p_train_id: trainId });

  const { data: train } = await supabase
    .from("raid_trains")
    .select("name, organizer_id")
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
